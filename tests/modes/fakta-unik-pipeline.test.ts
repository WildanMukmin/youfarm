import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runFaktaUnik, searchQueries, wrapForThumbnail, type PipelineDeps, type Progress } from '../../src/main/modes/fakta-unik/pipeline.ts'
import { createFfmpeg } from '../../src/main/platform/ffmpeg.ts'
import { createFootageLibrary } from '../../src/main/platform/footage-library.ts'
import { MIGRATIONS } from '../../src/main/platform/migrations.ts'
import { openSqlite } from '../../src/main/platform/sqlite.ts'
import { createPiper, pickVoice } from '../../src/main/platform/voice/piper.ts'
import { StockError, type StockClient, type StockVideo } from '../../src/main/platform/ai/stock.ts'

const ROOT = join(import.meta.dirname, '../..')
const BIN = join(ROOT, 'binaries/win-x64')
const PIPER_DIR = join(BIN, 'piper')
const MODELS = join(ROOT, 'models/piper')
const FONTS = join(ROOT, 'assets/fonts/caption')
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

  // Footage palsu vertikal dengan lama berbeda, disajikan lewat penyedia stock palsu.
  const clips: string[] = []
  for (let i = 0; i < 4; i++) {
    const p = join(dir, `src${i}.mp4`)
    await ff.run(['-f', 'lavfi', '-i', `testsrc2=size=540x960:rate=25:duration=${2 + i}`, '-pix_fmt', 'yuv420p', p])
    clips.push(p)
  }
  let nextId = 1
  const searches: string[] = []
  const sources: string[] = []
  const client: StockClient = {
    async search(q) {
      searches.push(q)
      const id = nextId++
      return [{ id, duration: 2 + (id % 4), width: 540, height: 960, fileUrl: `${id}`, pageUrl: '' } satisfies StockVideo]
    },
    async download(v, cacheDir) {
      const dest = join(cacheDir, `stock-${v.id}.mp4`)
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
    stock: (source) => (sources.push(source), client),
    speak,
    ffmpeg: ff,
    fontsDir: FONTS,
    cacheDir: join(dir, 'cache'),
    workDir: join(dir, 'work'),
    outDir: join(dir, 'out'),
    bitrateKbps: 3000,
    onProgress: (p) => events.push(p),
    ...over
  }
  return { deps, events, searches, sources, client, dir }
}

test('searchQueries dan wrapForThumbnail (murni)', () => {
  assert.deepEqual(searchQueries(['deep ocean', 'submarine']), ['deep ocean submarine', 'deep ocean', 'submarine'])
  assert.deepEqual(searchQueries(['ocean']), ['ocean'])
  assert.equal(wrapForThumbnail('Rahasia Laut Dalam yang Jarang Diketahui'), 'Rahasia Laut\\NDalam yang\\NJarang\\NDiketahui')
})

test('pipeline lengkap: ide jadi video 9:16 dengan caption, SRT, dan thumbnail', { skip }, async () => {
  const { deps, events, searches, sources } = await setup()
  const r = await runFaktaUnik({ topic: 'fakta laut dalam', language: 'id' }, deps)

  assert.equal(r.video.mode, 'fakta-unik')
  assert.equal(r.video.aspect, '9:16')
  assert.equal(r.video.title, SCRIPT.title)
  assert.equal(r.video.syntheticMedia, true)
  // Penyedia bawaan Pixabay, dan kreditnya ikut ke hasil.
  assert.deepEqual(sources, ['pixabay'])
  assert.deepEqual(r.video.credits, ['Footage: Pixabay (pixabay.com)'])
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

test('pipeline: sumber suara satu-permintaan (speakAll) menggantikan suara per kalimat dan peringatannya ikut', { skip }, async () => {
  let single = 0
  let batches = 0
  const a = await setup()
  a.deps.speak = async () => void single++
  a.deps.speakAll = async ({ texts, outs, options }) => {
    if (options.voiceSource !== 'gemini-tts') return null
    batches++
    assert.equal(texts.length, outs.length)
    for (let i = 0; i < outs.length; i++) await a.deps.ffmpeg.run(['-f', 'lavfi', '-i', `sine=frequency=300:duration=${Math.max(1, texts[i].length / 14)}`, outs[i]])
    return { warnings: ['batas diperkirakan'] }
  }
  const r = await runFaktaUnik({ topic: 'fakta laut', voiceSource: 'gemini-tts' }, a.deps)
  assert.equal(batches, 1)
  assert.equal(single, 0)
  assert.ok(r.warnings.includes('batas diperkirakan'))
  assert.ok(existsSync(r.video.filePath))

  // Sumber lain: speakAll mengembalikan null, jadi tiap kalimat diucapkan sendiri.
  const b = await setup()
  b.deps.speak = a.deps.speak
  let perSentence = 0
  b.deps.speak = async ({ text, out }) => {
    perSentence++
    await b.deps.ffmpeg.run(['-f', 'lavfi', '-i', `sine=frequency=300:duration=${Math.max(1, text.length / 14)}`, out])
  }
  b.deps.speakAll = async () => null
  await runFaktaUnik({ topic: 'fakta laut', voiceSource: 'piper' }, b.deps)
  assert.equal(perSentence, 4)
})

async function withLibrary(seed: boolean) {
  const t = await setup()
  const db = await openSqlite(join(t.dir, 'lib.sqlite'), MIGRATIONS)
  const lib = createFootageLibrary({ db, dirFor: (p) => join(t.dir, 'lib', p) })
  if (seed) {
    // Tiga klip cocok untuk tiap frasa pencarian naskah, supaya pustaka cukup untuk dipilih.
    let id = 100
    for (const phrase of ['deep ocean', 'underwater pressure', 'bioluminescence', 'research vessel']) {
      for (let k = 0; k < 3; k++, id++) {
        const dest = join(t.dir, 'lib', 'pixabay', `pixabay-${id}.mp4`)
        await mkdir(join(t.dir, 'lib', 'pixabay'), { recursive: true })
        await copyFile(join(t.dir, 'src0.mp4'), dest)
        await lib.use('pixabay', { id, duration: 2, width: 540, height: 960 }, dest, phrase, 0)
      }
    }
  }
  t.deps.library = lib
  t.deps.refreshRate = 0
  t.deps.random = () => 0
  return { ...t, lib, db }
}

test('pipeline + pustaka: pustaka kosong memakai penyedia dan mencatat klipnya di folder pustaka', { skip }, async () => {
  const t = await withLibrary(false)
  const r = await runFaktaUnik({ topic: 'fakta laut' }, t.deps)
  assert.equal(t.searches.length, 4)
  assert.equal(t.lib.stats().count, 4)
  assert.deepEqual(readdirSync(join(t.dir, 'lib', 'pixabay')).filter((f) => f.endsWith('.mp4')).length, 4)
  assert.ok(existsSync(r.video.filePath))
  t.db.close()
})

test('pipeline + pustaka: klip cocok di pustaka dipakai tanpa memanggil penyedia sama sekali', { skip }, async () => {
  const t = await withLibrary(true)
  const r = await runFaktaUnik({ topic: 'fakta laut' }, t.deps)
  assert.equal(t.searches.length, 0)
  assert.ok(existsSync(r.video.filePath))
  assert.deepEqual(r.warnings.filter((w) => /pustaka|memakai ulang/.test(w)), [])
  // Empat klip dipakai (satu per kalimat), dan sekarang dihindari untuk video berikutnya.
  assert.equal(t.lib.recentIds('pixabay', t.lib.beginVideo()).size, 4)
  t.db.close()
})

test('pipeline + pustaka: penyedia gagal (kuota) memakai pustaka dan memberi peringatan; tanpa pustaka tetap gagal', { skip }, async () => {
  const t = await withLibrary(true)
  t.deps.refreshRate = 1
  t.deps.stock = () => ({ search: async () => { throw new StockError('quota', 'Batas permintaan Pixabay tercapai.') }, download: t.client.download })
  const r = await runFaktaUnik({ topic: 'fakta laut' }, t.deps)
  assert.ok(existsSync(r.video.filePath))
  assert.equal(r.warnings.filter((w) => /pustaka lokal karena Pixabay/.test(w)).length, 4)
  t.db.close()

  const empty = await withLibrary(false)
  empty.deps.stock = () => ({ search: async () => { throw new StockError('quota', 'Batas permintaan Pixabay tercapai.') }, download: empty.client.download })
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, empty.deps), /Batas permintaan Pixabay/)
  empty.db.close()
})

test('pipeline + pustaka: batas ukuran membuang klip lama setelah video jadi, klip video ini aman', { skip }, async () => {
  const t = await withLibrary(true)
  t.deps.libraryMaxBytes = 1
  await runFaktaUnik({ topic: 'fakta laut' }, t.deps)
  // Hanya klip yang dipakai video ini yang tersisa.
  assert.equal(t.lib.stats().count, 4)
  t.db.close()
})

test('pipeline: tanpa footage sama sekali gagal jelas; sebagian kosong memakai ulang footage', { skip }, async () => {
  const none = await setup()
  none.deps.stock = () => ({ search: async () => [], download: none.client.download })
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, none.deps), /Tidak menemukan footage/)

  // Kata kunci yang ditolak penyedia ('bad') dilewati seperti hasil kosong; Pexels dipilih lewat opsi.
  const some = await setup()
  const picked: string[] = []
  some.deps.stock = (source) => {
    picked.push(source)
    return {
      search: async (q, s) => {
        if (/pressure/.test(q)) throw new StockError('bad', 'ditolak')
        return some.client.search(q, s)
      },
      download: some.client.download
    }
  }
  const r = await runFaktaUnik({ topic: 'fakta laut', stockSource: 'pexels' }, some.deps)
  assert.ok(r.warnings.some((w) => /Kalimat 2 memakai ulang/.test(w)))
  assert.ok(existsSync(r.video.filePath))
  assert.deepEqual(picked, ['pexels'])
  assert.deepEqual(r.video.credits, ['Footage: Pexels (pexels.com)'])

  // Key ditolak tetap menggagalkan, tidak diam-diam memakai ulang footage.
  const denied = await setup()
  denied.deps.stock = () => ({ search: async () => { throw new StockError('key', 'Key Pixabay ditolak.') }, download: denied.client.download })
  await assert.rejects(runFaktaUnik({ topic: 'fakta laut' }, denied.deps), /Key Pixabay ditolak/)
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

const HOOK_SCRIPT = {
  ...SCRIPT,
  hook: 'Kenapa kapal selam bisa remuk di laut dalam?',
  hookKeywords: ['submarine', 'deep ocean']
}

test('pipeline dengan hook: jadi segmen pertama (suara, footage, teks besar), caption kata demi kata dimulai sesudahnya', { skip }, async () => {
  const spoken: string[] = []
  let ass = ''
  const base = await setup()
  const run = base.deps.ffmpeg.run
  const deps: PipelineDeps = {
    ...base.deps,
    llm: async () => HOOK_SCRIPT,
    speak: async (p) => (spoken.push(p.text), base.deps.speak(p)),
    ffmpeg: {
      ...base.deps.ffmpeg,
      run: async (args, opts) => {
        if (args.includes('-filter_complex') && opts?.cwd && existsSync(join(opts.cwd, 'captions.ass'))) ass = readFileSync(join(opts.cwd, 'captions.ass'), 'utf8')
        return run(args, opts)
      }
    }
  }
  const r = await runFaktaUnik({ topic: 'fakta laut dalam', language: 'id', targetSec: 45 }, deps)

  assert.equal(r.script.hook, HOOK_SCRIPT.hook)
  assert.equal(spoken[0], HOOK_SCRIPT.hook, 'hook dibacakan pertama')
  assert.equal(spoken.length, 5, 'hook + 4 kalimat isi')
  assert.deepEqual(base.searches.length, 5)
  assert.match(base.searches[0], /submarine/, 'footage pertama dicari dari kata kunci hook')
  assert.deepEqual(r.warnings.filter((w) => /hook/i.test(w)), [])

  // Overlay hook ada satu, huruf kapital, di layer atas; tidak ada caption kata demi kata untuk kalimat hook.
  const hookLine = ass.split('\n').filter((l) => l.startsWith('Dialogue: 1,'))
  assert.equal(hookLine.length, 1)
  assert.match(hookLine[0], /,Hook,,/)
  assert.ok(hookLine[0].includes('KENAPA KAPAL SELAM BISA REMUK DI LAUT DALAM?'))
  assert.match(ass, /^Style: Hook,/m)
  const captionTexts = ass.split('\n').filter((l) => l.startsWith('Dialogue: 0,')).join(' ')
  assert.ok(!/REMUK/.test(captionTexts), 'kata hook tidak diulang sebagai caption')
  assert.match(captionTexts, /TAHUKAH|LAUT/)

  // SRT tetap memuat ucapan hook, supaya track caption YouTube lengkap.
  assert.match(readFileSync(r.video.captionPath!, 'utf8'), /remuk/i)
  assert.equal(r.video.script.startsWith(HOOK_SCRIPT.hook), true)
})

test('pipeline: hook bermasalah diulang sekali, lalu video tetap jadi (tanpa hook) dengan peringatan', { skip }, async () => {
  let calls = 0
  const { deps } = await setup({
    llm: async () => {
      calls++
      return { ...SCRIPT, hook: '' }
    }
  })
  const r = await runFaktaUnik({ topic: 'fakta laut dalam', language: 'id', targetSec: 45 }, deps)
  assert.equal(calls, 2)
  assert.equal(r.script.hook, null)
  assert.ok(r.warnings.some((w) => /tanpa hook/i.test(w)))

  // Durasi di bawah batas atau opsi mati: hook tidak diminta sama sekali.
  const off = await setup({ llm: async () => SCRIPT })
  const r2 = await runFaktaUnik({ topic: 'fakta laut dalam', language: 'id', hook: false }, off.deps)
  assert.equal(r2.script.hook, null)
  assert.deepEqual(r2.warnings.filter((w) => /hook/i.test(w)), [])
})
