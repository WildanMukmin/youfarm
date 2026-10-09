import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runFaktaUnik, searchQueries, wrapForThumbnail, type PipelineDeps, type Progress } from '../../src/main/modes/fakta-unik/pipeline.ts'
import { createFfmpeg } from '../../src/main/platform/ffmpeg.ts'
import { createPiper, pickVoice } from '../../src/main/platform/voice/piper.ts'
import type { StockVideo } from '../../src/main/platform/ai/pexels-client.ts'

const ROOT = join(import.meta.dirname, '../..')
const BIN = join(ROOT, 'binaries/win-x64')
const PIPER_DIR = join(BIN, 'piper')
const MODELS = join(ROOT, 'models/piper')
const FONT = join(ROOT, 'assets/fonts/caption/Poppins-Bold.ttf')
const hasFfmpeg = existsSync(join(BIN, 'ffmpeg.exe'))
const hasPiper = existsSync(join(PIPER_DIR, 'piper.exe')) && existsSync(join(MODELS, 'id_ID-news_tts-medium.onnx'))
const skip = hasFfmpeg ? false : 'ffmpeg belum terpasang (npm run setup:ffmpeg)'

const SCRIPT = {
  title: 'Rahasia Laut Dalam yang Jarang Diketahui',
  sentences: [
    { text: 'Tahukah kamu bahwa laut dalam masih jauh lebih sedikit dipetakan dibanding permukaan bulan?', keywords: ['deep ocean', 'submarine'] },
    { text: 'Di kedalaman ribuan meter, tekanan air bisa menghancurkan kapal selam biasa.', keywords: ['underwater pressure'] },
    { text: 'Makhluk di sana bercahaya sendiri untuk berburu dan mencari pasangan.', keywords: ['bioluminescence', 'jellyfish'] },
    { text: 'Setiap ekspedisi baru hampir selalu menemukan spesies yang belum bernama.', keywords: ['research vessel'] }
  ],
  description: 'Fakta menarik tentang laut dalam.',
  tags: ['laut', 'fakta']
}

async function setup(over: Partial<PipelineDeps> & { llm?: PipelineDeps['llm'] } = {}) {
  const ff = createFfmpeg(BIN)
  const dir = mkdtempSync(join(tmpdir(), 'yf-pipe-'))

  // Footage palsu vertikal dengan lama berbeda, disajikan lewat "Pexels" palsu.
  const clips: string[] = []
  for (let i = 0; i < 4; i++) {
    const p = join(dir, `src${i}.mp4`)
    await ff.run(['-f', 'lavfi', '-i', `testsrc2=size=540x960:rate=25:duration=${2 + i}`, '-pix_fmt', 'yuv420p', p])
    clips.push(p)
  }
  let nextId = 1
  const searches: string[] = []
  const stock: PipelineDeps['stock'] = {
    async search(q) {
      searches.push(q)
      const id = nextId++
      return [{ id, duration: 2 + (id % 4), width: 540, height: 960, fileUrl: `${id}`, pageUrl: '' } satisfies StockVideo]
    },
    async download(v, cacheDir) {
      const dest = join(cacheDir, `pexels-${v.id}.mp4`)
      await import('node:fs/promises').then((fs) => fs.mkdir(cacheDir, { recursive: true }))
      await copyFile(clips[v.id % clips.length], dest)
      return dest
    }
  }

  const piper = createPiper({ piperDir: PIPER_DIR, modelsDir: MODELS })
  const voice = hasPiper ? pickVoice(piper.voices(), 'id') : null
  const speak: PipelineDeps['speak'] = async ({ text, out, signal }) => {
    if (voice) return piper.synth({ text, voice, out, signal })
    // Tanpa Piper: nada sederhana yang panjangnya sebanding dengan teks.
    await ff.run(['-f', 'lavfi', '-i', `sine=frequency=300:duration=${Math.max(1, text.length / 14)}`, out], { signal })
  }

  const events: Progress[] = []
  const deps: PipelineDeps = {
    llm: async () => SCRIPT,
    stock,
    speak,
    ffmpeg: ff,
    fontFile: FONT,
    cacheDir: join(dir, 'cache'),
    workDir: join(dir, 'work'),
    outDir: join(dir, 'out'),
    bitrateKbps: 3000,
    onProgress: (p) => events.push(p),
    ...over
  }
  return { deps, events, searches, dir }
}

test('searchQueries dan wrapForThumbnail (murni)', () => {
  assert.deepEqual(searchQueries(['deep ocean', 'submarine']), ['deep ocean submarine', 'deep ocean', 'submarine'])
  assert.deepEqual(searchQueries(['ocean']), ['ocean'])
  assert.equal(wrapForThumbnail('Rahasia Laut Dalam yang Jarang Diketahui'), 'Rahasia Laut\\NDalam yang\\NJarang\\NDiketahui')
})

test('pipeline lengkap: ide jadi video 9:16 dengan caption, SRT, dan thumbnail', { skip }, async () => {
  const { deps, events, searches } = await setup()
  const r = await runFaktaUnik({ topic: 'fakta laut dalam', language: 'id' }, deps)

  assert.equal(r.video.mode, 'fakta-unik')
  assert.equal(r.video.aspect, '9:16')
  assert.equal(r.video.title, SCRIPT.title)
  assert.equal(r.video.syntheticMedia, true)
  assert.ok(existsSync(r.video.filePath) && statSync(r.video.filePath).size > 10_000)
  assert.deepEqual(await deps.ffmpeg.size(r.video.filePath), { width: 1080, height: 1920 })

  // Durasi video = jumlah ucapan + jeda; harus masuk akal untuk 4 kalimat.
  assert.ok(r.video.durationSec > 8 && r.video.durationSec < 60, `durasi ${r.video.durationSec}`)

  // SRT berisi caption dan thumbnail berupa JPEG di bawah batas 2 MB YouTube.
  const srt = readFileSync(r.video.captionPath!, 'utf8')
  assert.match(srt, /-->/)
  assert.match(srt, /laut/i)
  const thumb = readFileSync(r.video.thumbnailPath!)
  assert.deepEqual([...thumb.subarray(0, 2)], [0xff, 0xd8])
  assert.ok(thumb.length < 2 * 1024 * 1024)

  // Satu pencarian per kalimat (footage langsung ketemu), footage tidak berulang.
  assert.equal(searches.length, 4)
  assert.deepEqual(r.warnings.filter((w) => /memakai ulang/.test(w)), [])

  // Progres naik monoton dan berakhir 100; folder kerja dibersihkan.
  const pct = events.map((e) => e.percent)
  assert.deepEqual([...pct].sort((a, b) => a - b), pct)
  assert.equal(pct.at(-1), 100)
  assert.deepEqual(new Set(events.map((e) => e.stage)), new Set(['script', 'voice', 'visual', 'render', 'thumbnail', 'done']))
  assert.deepEqual(readdirSync(deps.workDir), [])
})

test('pipeline: JSON AI rusak diulang sekali; gagal dua kali memberi error jelas', { skip }, async () => {
  let calls = 0
  const a = await setup({
    llm: async () => {
      calls++
      return calls === 1 ? { title: '', sentences: [] } : SCRIPT
    }
  })
  await runFaktaUnik({ topic: 'fakta laut' }, a.deps)
  assert.equal(calls, 2)

  const b = await setup({ llm: async () => ({ title: 'x', sentences: [] }) })
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, b.deps), /terlalu pendek/)
})

test('pipeline: tanpa footage sama sekali gagal jelas; sebagian kosong memakai ulang footage', { skip }, async () => {
  const none = await setup()
  none.deps.stock = { search: async () => [], download: none.deps.stock.download }
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, none.deps), /Tidak menemukan footage/)

  const some = await setup()
  const realSearch = some.deps.stock.search
  some.deps.stock = { search: async (q, s) => (/pressure/.test(q) ? [] : realSearch(q, s)), download: some.deps.stock.download }
  const r = await runFaktaUnik({ topic: 'fakta laut' }, some.deps)
  assert.ok(r.warnings.some((w) => /Kalimat 2 memakai ulang/.test(w)))
  assert.ok(existsSync(r.video.filePath))
})

test('pipeline: opsi tidak valid ditolak sebelum memanggil AI; pembatalan menghentikan dan membersihkan', { skip }, async () => {
  let called = false
  const bad = await setup({ llm: async () => ((called = true), SCRIPT) })
  await assert.rejects(runFaktaUnik({ topic: 'x' }, bad.deps), /minimal 3 karakter/)
  assert.equal(called, false)

  const ac = new AbortController()
  const s = await setup({ onProgress: (p) => p.stage === 'voice' && ac.abort() })
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, s.deps, ac.signal), /dibatalkan|Proses dibatalkan/)
  assert.deepEqual(readdirSync(s.deps.workDir), [])
})
