import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RenderedVideo } from '../../../shared/contracts/modes.ts'
import {
  buildScriptPrompt,
  parseScript,
  scriptLanguageMismatch,
  scriptLengthWarning,
  validateOptions,
  type FaktaScript,
  type FaktaUnikOptions
} from '../../../shared/modes/fakta-unik.ts'
import type { Ffmpeg } from '../../platform/ffmpeg.ts'
import { STOCK_INFO, type StockSource } from '../../../shared/stock.ts'
import { StockError, pickVideo, type StockClient } from '../../platform/ai/stock.ts'
import { REFRESH_RATE } from '../../../shared/footage.ts'
import { clipKey, type FootageLibrary } from '../../platform/footage-library.ts'
import { buildChunks, toAss, toSrt, type SentenceTiming } from './captions.ts'
import { buildRenderArgs, HEIGHT, WIDTH, type ClipSegment } from './render.ts'

export type Stage = 'script' | 'voice' | 'visual' | 'render' | 'thumbnail' | 'done'

export interface Progress {
  stage: Stage
  /** 0 sampai 100 untuk seluruh pipeline. */
  percent: number
  message: string
}

export interface PipelineDeps {
  /** Penulis naskah sesuai penyedia dan model di opsi video. */
  llm: (p: { system: string; user: string; options: FaktaUnikOptions; signal?: AbortSignal }) => Promise<unknown>
  /** Klien footage untuk penyedia yang dipilih di opsi. */
  stock: (source: StockSource) => StockClient
  /** Ucapkan satu kalimat ke berkas WAV. */
  speak: (p: { text: string; out: string; options: FaktaUnikOptions; signal?: AbortSignal }) => Promise<void>
  /**
   * Ucapkan seluruh naskah sekaligus dan tulis satu WAV per kalimat ke `outs`. Mengembalikan null bila sumber suara
   * pilihan tidak memakai cara ini; pipeline lalu memanggil `speak` per kalimat.
   */
  speakAll?: (p: { texts: string[]; outs: string[]; options: FaktaUnikOptions; signal?: AbortSignal }) => Promise<{ warnings: string[] } | null>
  ffmpeg: Ffmpeg
  /** Folder TTF caption yang dibundel (assets/fonts/caption); disalin ke folder kerja untuk ffmpeg. */
  fontsDir: string
  /** Folder cache footage (dipakai ulang antar video). Dipakai bila `library` tidak ada. */
  cacheDir: string
  /** Pustaka footage lokal: dipakai dulu bila ada klip cocok, dan jadi cadangan saat penyedia stock gagal. */
  library?: FootageLibrary
  /** Peluang meminta penyedia walau pustaka punya kandidat. Bawaan: REFRESH_RATE. */
  refreshRate?: number
  /** Pembangkit acak 0 sampai <1 untuk memilih klip. Bawaan: Math.random. */
  random?: () => number
  /** Batas ukuran pustaka; kelebihannya dibuang (yang paling lama tidak dipakai) setelah video jadi. */
  libraryMaxBytes?: number
  /** Folder kerja sementara. */
  workDir: string
  /** Folder hasil akhir. */
  outDir: string
  bitrateKbps: number
  /** Dipanggil tiap tahap. */
  onProgress?: (p: Progress) => void
  now?: () => Date
}

export interface PipelineResult {
  video: RenderedVideo
  script: FaktaScript
  /** Berkas SRT (juga ada di video.captionPath). */
  warnings: string[]
}

const SENTENCE_PAD_SEC = 0.25
const LAST_PAD_SEC = 0.7

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'video'

/** Kata kunci yang dicoba berurutan: semua digabung, lalu satu per satu. */
export function searchQueries(keywords: string[]): string[] {
  const all = keywords.join(' ')
  return [...new Set([all, ...keywords])].filter(Boolean)
}

/** Potong judul menjadi baris pendek (tanda \N di ASS) untuk thumbnail. */
export function wrapForThumbnail(text: string, maxChars = 14): string {
  const lines: string[] = []
  let cur = ''
  for (const w of text.trim().split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur)
      cur = w
    } else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 4).join('\\N')
}

function thumbnailAss(title: string): string {
  const text = wrapForThumbnail(title.toUpperCase()).replace(/[{}]/g, '')
  return [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Poppins,120,&H0000F0FF,&H0000F0FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,10,3,5,60,60,0,1', '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,${text}`, ''
  ].join('\n')
}

async function moveFile(from: string, to: string): Promise<void> {
  // Folder kerja dan folder hasil bisa beda drive, jadi salin lalu hapus.
  await copyFile(from, to)
  await rm(from, { force: true })
}

/** Dari ide sampai video siap upload. Tiap tahap melapor progres dan menghormati `signal`. */
export async function runFaktaUnik(rawOptions: unknown, deps: PipelineDeps, signal?: AbortSignal): Promise<PipelineResult> {
  const options = validateOptions(rawOptions)
  const report = (stage: Stage, percent: number, message: string): void => deps.onProgress?.({ stage, percent, message })
  const check = (): void => {
    if (signal?.aborted) throw new Error('Pembuatan video dibatalkan.')
  }
  const warnings: string[] = []
  const stamp = (deps.now ?? (() => new Date()))().getTime()
  const job = join(deps.workDir, String(stamp))
  await mkdir(join(job, 'fonts'), { recursive: true })
  await mkdir(deps.outDir, { recursive: true })

  try {
    // 1. Naskah. Satu kali ulang bila keluaran AI tidak bisa dipakai.
    report('script', 2, 'Menulis naskah…')
    const prompt = buildScriptPrompt(options)
    let script: FaktaScript | null = null
    let lastErr: unknown
    for (let attempt = 0; attempt < 2 && !script; attempt++) {
      check()
      try {
        const parsed = parseScript(await deps.llm({ ...prompt, options, signal }))
        if (scriptLanguageMismatch(parsed, options.language)) throw new Error(`AI menulis naskah bukan dalam bahasa yang dipilih (${options.language}). Coba lagi atau pakai model lain.`)
        script = parsed
      } catch (e) {
        lastErr = e
        if (signal?.aborted) throw e
      }
    }
    if (!script) throw lastErr instanceof Error ? lastErr : new Error('Gagal membuat naskah.')
    const lengthWarning = scriptLengthWarning(script, options)
    if (lengthWarning) warnings.push(lengthWarning)
    const n = script.sentences.length
    report('script', 10, `Naskah siap (${n} kalimat).`)

    // 2. Suara per kalimat, lalu digabung jadi satu narasi.
    const wavs = script.sentences.map((_, i) => join(job, `s${i}.wav`))
    const speech: number[] = []
    // Sumber suara yang membatasi jumlah permintaan membacakan seluruh naskah sekali jalan.
    check()
    report('voice', 10, 'Membuat suara…')
    const batch = await deps.speakAll?.({ texts: script.sentences.map((s) => s.text), outs: wavs, options, signal })
    if (batch) warnings.push(...batch.warnings)
    for (let i = 0; i < n; i++) {
      check()
      if (!batch) {
        report('voice', 10 + Math.round((i / n) * 20), `Membuat suara ${i + 1}/${n}…`)
        await deps.speak({ text: script.sentences[i].text, out: wavs[i], options, signal })
      }
      speech.push(await deps.ffmpeg.duration(wavs[i]))
    }
    const pads = speech.map((_, i) => (i === n - 1 ? LAST_PAD_SEC : SENTENCE_PAD_SEC))
    const narration = join(job, 'narration.wav')
    const inputs = wavs.flatMap((w) => ['-i', w])
    const chain = wavs.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=${pads[i]}[a${i}]`)
    await deps.ffmpeg.run(
      [...inputs, '-filter_complex', `${chain.join(';')};${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[out]`, '-map', '[out]', narration],
      { signal }
    )
    report('voice', 32, 'Suara siap.')

    // 3. Footage per kalimat.
    const durations = speech.map((s, i) => s + pads[i])
    const source = options.stockSource
    const stock = deps.stock(source)
    const lib = deps.library
    const seq = lib?.beginVideo() ?? 0
    const rng = deps.random ?? Math.random
    const refresh = deps.refreshRate ?? REFRESH_RATE
    const avoid = lib?.recentIds(source, seq)
    const cacheDir = lib ? lib.dirFor(source) : deps.cacheDir
    const used = new Set<number>()
    const inUse = new Set<string>()
    const segments: ClipSegment[] = []
    for (let i = 0; i < n; i++) {
      check()
      report('visual', 32 + Math.round((i / n) * 28), `Mencari footage ${i + 1}/${n}…`)
      const queries = searchQueries(script.sentences[i].keywords)
      const localClip = (relaxed: boolean) => lib?.pick(source, queries, { neededSec: durations[i], used, seq, rng, relaxed }) ?? null
      let path: string | null = null

      // 1. Pustaka lokal dulu. Sesekali sengaja bertanya ke penyedia supaya stok tetap segar.
      if (lib && rng() >= refresh) {
        const clip = localClip(false)
        if (clip) {
          used.add(clip.id)
          inUse.add(clipKey(source, clip.id))
          await lib.use(source, clip, clip.path, null, seq)
          path = clip.path
        }
      }

      // 2. Penyedia stock. Bila gagal (key, kuota, jaringan) dan pustaka punya klip yang agak cocok, pakai itu.
      if (!path) {
        try {
          for (const q of queries) {
            let results
            try {
              results = await stock.search(q, signal)
            } catch (e) {
              // Kata kunci yang ditolak penyedia cukup dilewati; key salah atau batas permintaan tetap menggagalkan.
              if (e instanceof StockError && e.kind === 'bad') continue
              throw e
            }
            const found = pickVideo(results, { neededSec: durations[i], used, avoid, rng: lib ? rng : undefined })
            if (found) {
              used.add(found.id)
              path = await stock.download(found, cacheDir, signal)
              if (lib) {
                inUse.add(clipKey(source, found.id))
                await lib.use(source, found, path, q, seq)
              }
              break
            }
          }
        } catch (e) {
          const clip = signal?.aborted ? null : localClip(true)
          if (!clip) throw e
          used.add(clip.id)
          inUse.add(clipKey(source, clip.id))
          await lib!.use(source, clip, clip.path, null, seq)
          path = clip.path
          warnings.push(`Kalimat ${i + 1} memakai footage dari pustaka lokal karena ${STOCK_INFO[source].label} tidak bisa dipakai: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (!path) {
        // Tidak ada footage baru: pakai ulang segmen sebelumnya daripada menggagalkan seluruh video.
        const prev = segments.at(-1)
        if (!prev) throw new Error(`Tidak menemukan footage untuk "${script.sentences[i].keywords.join(', ')}". Coba topik lain.`)
        warnings.push(`Kalimat ${i + 1} memakai ulang footage sebelumnya (tidak ada hasil pencarian baru).`)
        path = prev.path
      }
      segments.push({ path, duration: durations[i] })
    }
    // Batas ukuran pustaka: yang paling lama tidak dipakai dibuang, kecuali klip video ini.
    if (lib && deps.libraryMaxBytes) await lib.prune(deps.libraryMaxBytes, inUse).catch(() => undefined)
    report('visual', 60, 'Footage siap.')

    // 4. Caption.
    let t = 0
    const timings: SentenceTiming[] = script.sentences.map((s, i) => {
      const timing = { text: s.text, start: t, speechSec: speech[i] }
      t += speech[i] + pads[i]
      return timing
    })
    const chunks = buildChunks(timings, options.language, options.caption.wordsPerChunk)
    await cp(deps.fontsDir, join(job, 'fonts'), { recursive: true, filter: (src) => !/\.txt$/i.test(src) })
    await writeFile(join(job, 'captions.ass'), toAss(chunks, options.caption, options.language))
    const base = `${slug(script.title)}-${stamp}`
    const srtPath = join(deps.outDir, `${base}.srt`)
    await writeFile(srtPath, toSrt(chunks, options.language), 'utf8')

    // 5. Render.
    report('render', 62, 'Merender video…')
    const total = durations.reduce((a, b) => a + b, 0)
    const rawOut = join(job, 'out.mp4')
    await deps.ffmpeg.run(
      buildRenderArgs({ segments, narrationPath: narration, assFile: 'captions.ass', fontsDir: 'fonts', output: rawOut, bitrateKbps: deps.bitrateKbps }),
      { signal, cwd: job, onProgress: (sec) => report('render', 62 + Math.round(Math.min(1, sec / total) * 28), 'Merender video…') }
    )
    const durationSec = await deps.ffmpeg.duration(rawOut)

    // 6. Thumbnail dari frame awal dengan judul besar.
    report('thumbnail', 92, 'Membuat thumbnail…')
    await writeFile(join(job, 'thumb.ass'), thumbnailAss(script.title))
    await deps.ffmpeg.run(
      // Frame dari footage mentah (bukan video akhir) supaya caption tidak ikut terbakar di thumbnail.
      ['-ss', '0.8', '-i', segments[0].path, '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},ass=thumb.ass:fontsdir=fonts`, '-frames:v', '1', '-q:v', '3', 'thumb.jpg'],
      { signal, cwd: job }
    )

    const videoPath = join(deps.outDir, `${base}.mp4`)
    const thumbPath = join(deps.outDir, `${base}.jpg`)
    await moveFile(rawOut, videoPath)
    await moveFile(join(job, 'thumb.jpg'), thumbPath)
    report('done', 100, 'Selesai.')

    return {
      script,
      warnings,
      video: {
        filePath: videoPath,
        thumbnailPath: thumbPath,
        captionPath: srtPath,
        durationSec,
        aspect: '9:16',
        mode: 'fakta-unik',
        template: null,
        title: script.title,
        script: script.sentences.map((s) => s.text).join(' '),
        // Narasi dibuat oleh suara AI, jadi ditandai sintetis.
        syntheticMedia: true,
        language: options.language,
        credits: [STOCK_INFO[options.stockSource].credit]
      }
    }
  } finally {
    await rm(job, { recursive: true, force: true })
  }
}
