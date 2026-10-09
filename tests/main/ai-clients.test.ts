import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GeminiError, createGeminiClient, parseJsonLoose, pcmToWav } from '../../src/main/platform/ai/gemini-client.ts'
import { createPexelsClient, normalizeVideos, pickFile } from '../../src/main/platform/ai/pexels-client.ts'
import { SEARCH_CACHE_MS, createPixabayClient, normalizeHits, pickRendition } from '../../src/main/platform/ai/pixabay-client.ts'
import { StockError, pickVideo, type StockVideo } from '../../src/main/platform/ai/stock.ts'
import { GroqError, createGroqClient } from '../../src/main/platform/ai/groq-client.ts'
import { DeepgramError, createDeepgramTts } from '../../src/main/platform/voice/deepgram.ts'
import { DEEPGRAM_VOICES, languageInfo, speechUnits, splitWords, voiceSourceSupports } from '../../src/shared/languages.ts'

async function serve(handler: (req: import('node:http').IncomingMessage, body: string, res: import('node:http').ServerResponse) => void): Promise<{ base: string; server: Server; close: () => void }> {
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    handler(req, body, res)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => (server.close(), server.closeAllConnections()) }
}
const send = (res: import('node:http').ServerResponse, code: number, b: unknown): void => void res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(b))

test('pcmToWav: header WAV benar', () => {
  const wav = pcmToWav(Buffer.alloc(48000), 24000)
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
  assert.equal(wav.readUInt32LE(24), 24000)
  assert.equal(wav.readUInt32LE(40), 48000)
  assert.equal(wav.length, 44 + 48000)
})

test('parseJsonLoose: pagar kode, teks di sekitar JSON, dan sampah', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJsonLoose('Ini hasilnya: {"a":1} semoga membantu'), { a: 1 })
  assert.throws(() => parseJsonLoose('bukan json'), (e: unknown) => e instanceof GeminiError && e.kind === 'bad')
})

test('gemini: completeJson mengirim prompt, key di header, dan mengurai JSON', async () => {
  let seen: { path: string; key: string; body: Record<string, unknown> } | null = null
  const s = await serve((req, body, res) => {
    seen = { path: req.url ?? '', key: String(req.headers['x-goog-api-key']), body: JSON.parse(body) }
    send(res, 200, { candidates: [{ content: { parts: [{ text: '```json\n{"title":"Halo"}\n```' }] } }] })
  })
  try {
    const c = createGeminiClient({ apiKey: () => 'KEY123', base: s.base })
    assert.deepEqual(await c.completeJson({ model: 'gemini-x', system: 'SYS', user: 'USR' }), { title: 'Halo' })
    assert.equal(seen!.path, '/models/gemini-x:generateContent')
    assert.equal(seen!.key, 'KEY123')
    assert.ok(!seen!.path.includes('KEY123'), 'key tidak boleh ada di URL')
    const b = seen!.body as { systemInstruction: { parts: { text: string }[] }; generationConfig: { responseMimeType: string } }
    assert.equal(b.systemInstruction.parts[0].text, 'SYS')
    assert.equal(b.generationConfig.responseMimeType, 'application/json')
  } finally {
    s.close()
  }
})

test('gemini: speak mengembalikan WAV dari PCM dengan sample rate dari respons', async () => {
  const pcm = Buffer.alloc(2400, 3)
  const s = await serve((_req, _b, res) => send(res, 200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=22050', data: pcm.toString('base64') } }] } }] }))
  try {
    const wav = await createGeminiClient({ apiKey: () => 'k', base: s.base }).speak({ model: 'tts', voice: 'Kore', text: 'halo' })
    assert.equal(wav.readUInt32LE(24), 22050)
    assert.equal(wav.length, 44 + 2400)
  } finally {
    s.close()
  }
})

test('gemini: klasifikasi error, retry 503, dan tanpa key', async () => {
  let n = 0
  let mode = 503
  const s = await serve((_req, _b, res) => {
    n++
    if (mode === 503 && n < 3) return send(res, 503, { error: { message: 'overloaded' } })
    if (mode === 503) return send(res, 200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
    if (mode === 400) return send(res, 400, { error: { message: 'API key not valid. Please pass a valid API key.' } })
    if (mode === 429) return send(res, 429, { error: { message: 'quota' } })
    send(res, 200, { promptFeedback: { blockReason: 'SAFETY' } })
  })
  try {
    const c = createGeminiClient({ apiKey: () => 'k', base: s.base, retryDelayMs: 1 })
    assert.deepEqual(await c.completeJson({ model: 'm', system: '', user: '' }), { ok: true })
    assert.equal(n, 3, 'dua kali gagal 503 lalu berhasil')

    mode = 400
    await assert.rejects(c.completeJson({ model: 'm', system: '', user: '' }), (e: unknown) => e instanceof GeminiError && e.kind === 'key')
    mode = 429
    await assert.rejects(c.completeJson({ model: 'm', system: '', user: '' }), (e: unknown) => e instanceof GeminiError && e.kind === 'quota')
    mode = 0
    await assert.rejects(c.completeJson({ model: 'm', system: '', user: '' }), (e: unknown) => e instanceof GeminiError && e.kind === 'blocked')
    await assert.rejects(createGeminiClient({ apiKey: () => undefined, base: s.base }).completeJson({ model: 'm', system: '', user: '' }), /belum diisi/)
  } finally {
    s.close()
  }
})

const files = [
  { quality: 'sd', file_type: 'video/mp4', width: 540, height: 960, link: 'https://x/sd.mp4' },
  { quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'https://x/hd.mp4' },
  { quality: 'uhd', file_type: 'video/mp4', width: 2160, height: 3840, link: 'https://x/uhd.mp4' },
  { quality: 'x', file_type: 'video/webm', width: 1080, height: 1920, link: 'https://x/a.webm' }
]

test('pexels: pilih berkas cukup besar yang terkecil, dan normalisasi respons', () => {
  assert.equal(pickFile(files)?.link, 'https://x/hd.mp4')
  assert.equal(pickFile([{ file_type: 'video/mp4', width: 400, height: 300, link: 'https://x/small.mp4' }])?.link, 'https://x/small.mp4')
  assert.equal(pickFile([]), null)
  const v = normalizeVideos({ videos: [{ id: 1, duration: 9, url: 'https://p/1', video_files: files }, { id: 2, duration: 5, video_files: [] }, { duration: 3 }] })
  assert.equal(v.length, 1)
  assert.deepEqual([v[0].id, v[0].fileUrl, v[0].pageUrl], [1, 'https://x/hd.mp4', 'https://p/1'])
  assert.deepEqual(normalizeVideos(null), [])
})

test('stock: pickVideo menghindari yang sudah dipakai dan memilih yang vertikal serta cukup panjang', () => {
  const mk = (id: number, duration: number, w: number, h: number): StockVideo => ({ id, duration, width: w, height: h, fileUrl: '', pageUrl: '' })
  const c = [mk(1, 3, 1080, 1920), mk(2, 12, 1920, 1080), mk(3, 12, 1080, 1920), mk(4, 2, 1080, 1920)]
  assert.equal(pickVideo(c, { neededSec: 6, used: new Set() })?.id, 3)
  // Vertikal tetap diutamakan walau lebih pendek, karena footage lanskap harus di-crop dan kehilangan banyak frame.
  assert.equal(pickVideo(c, { neededSec: 6, used: new Set([3]) })?.id, 1)
  assert.equal(pickVideo(c, { neededSec: 6, used: new Set([3, 1]) })?.id, 4)
  assert.equal(pickVideo(c, { neededSec: 6, used: new Set([3, 1, 4]) })?.id, 2)
  assert.equal(pickVideo(c, { neededSec: 6, used: new Set([1, 2, 3, 4]) }), null)
})

test('pexels: search memakai header Authorization, error terklasifikasi, unduhan dicache', async () => {
  let mode = 200
  let downloads = 0
  const s = await serve((req, _b, res) => {
    if (req.url?.startsWith('/videos/search')) {
      if (req.headers.authorization !== 'PEXKEY') return send(res, 401, {})
      if (mode === 429) return send(res, 429, {})
      return send(res, 200, { videos: [{ id: 7, duration: 8, url: 'https://p/7', video_files: [{ file_type: 'video/mp4', width: 1080, height: 1920, link: `http://${req.headers.host}/dl/7.mp4` }] }] })
    }
    if (req.url === '/dl/7.mp4') {
      downloads++
      return void res.writeHead(200, { 'Content-Type': 'video/mp4' }).end(Buffer.alloc(5000, 1))
    }
    send(res, 404, {})
  })
  try {
    const c = createPexelsClient({ apiKey: () => 'PEXKEY', base: s.base })
    const found = await c.search('ocean waves')
    assert.equal(found[0].id, 7)

    const dir = mkdtempSync(join(tmpdir(), 'yf-px-'))
    const p1 = await c.download(found[0], dir)
    assert.equal(statSync(p1).size, 5000)
    assert.equal(readFileSync(p1)[0], 1)
    assert.ok(!existsSync(`${p1}.part`))
    assert.equal(await c.download(found[0], dir), p1)
    assert.equal(downloads, 1, 'unduhan kedua memakai cache')

    await assert.rejects(createPexelsClient({ apiKey: () => 'SALAH', base: s.base }).search('x'), (e: unknown) => e instanceof StockError && e.kind === 'key')
    await assert.rejects(createPexelsClient({ apiKey: () => undefined, base: s.base }).search('x'), (e: unknown) => e instanceof StockError && e.kind === 'key')
    mode = 429
    await assert.rejects(c.search('x'), (e: unknown) => e instanceof StockError && e.kind === 'quota')
  } finally {
    s.close()
  }
})

const rendition = (w: number, h: number, size = 1000, url = `https://cdn/${w}x${h}.mp4`) => ({ url, width: w, height: h, size, thumbnail: '' })

test('pixabay: rendisi terkecil yang sisi pendeknya ≥ 1080; rendisi kosong dan raksasa dilewati', () => {
  // Kasus umum: large 4K, medium 1080p, small 720p.
  assert.equal(pickRendition({ large: rendition(3840, 2160), medium: rendition(1920, 1080), small: rendition(1280, 720), tiny: rendition(960, 540) })?.width, 1920)
  // medium hanya 720p: large 4K dipilih karena satu-satunya yang cukup tajam setelah crop 9:16.
  assert.equal(pickRendition({ large: rendition(3840, 2160), medium: rendition(1280, 720), tiny: rendition(960, 540) })?.width, 3840)
  // large kosong (url '' dan size 0) dan large yang terlalu besar dilewati, jatuh ke yang terbesar yang tersisa.
  assert.equal(pickRendition({ large: { url: '', width: 0, height: 0, size: 0 }, medium: rendition(1280, 720), tiny: rendition(960, 540) })?.width, 1280)
  assert.equal(pickRendition({ large: rendition(3840, 2160, 400 * 1024 * 1024), medium: rendition(1280, 720) })?.width, 1280)
  // Footage vertikal.
  assert.equal(pickRendition({ large: rendition(2160, 3840), medium: rendition(1080, 1920), small: rendition(720, 1280) })?.height, 1920)
  assert.equal(pickRendition(undefined), null)

  const v = normalizeHits({ hits: [{ id: 5, duration: 12, pageURL: 'https://pixabay.com/videos/x-5/', videos: { medium: rendition(1920, 1080) } }, { id: 6, duration: 4, videos: {} }, { duration: 3 }] })
  assert.equal(v.length, 1)
  assert.deepEqual([v[0].id, v[0].fileUrl, v[0].pageUrl, v[0].width], [5, 'https://cdn/1920x1080.mp4', 'https://pixabay.com/videos/x-5/', 1920])
  assert.deepEqual(normalizeHits(null), [])
})

test('pixabay: key di query, hasil dicache 24 jam (memori dan disk), error terklasifikasi, unduhan dicache', async () => {
  let searches = 0
  let downloads = 0
  let mode: 'ok' | 'rate-once' | 'rate' | 'bad' = 'ok'
  const seen: URLSearchParams[] = []
  const s = await serve((req, _b, res) => {
    const u = new URL(req.url!, 'http://x')
    if (u.pathname === '/videos/') {
      seen.push(u.searchParams)
      if (u.searchParams.get('key') !== 'PIXKEY') return void res.writeHead(400, { 'Content-Type': 'text/plain' }).end('[ERROR 400] "key" is wrong or missing.')
      if (mode === 'bad') return void res.writeHead(400, { 'Content-Type': 'text/plain' }).end('[ERROR 400] "q" is too long.')
      if (mode === 'rate' || mode === 'rate-once') {
        if (mode === 'rate-once') mode = 'ok'
        return void res.writeHead(429, { 'X-RateLimit-Reset': mode === 'rate' ? '600' : '0' }).end('slow down')
      }
      searches++
      return send(res, 200, { total: 1, totalHits: 1, hits: [{ id: 9, duration: 10, pageURL: 'https://pixabay.com/videos/9/', videos: { medium: rendition(1920, 1080, 5000, `http://${req.headers.host}/dl/9.mp4`) } }] })
    }
    if (u.pathname === '/dl/9.mp4') {
      downloads++
      return void res.writeHead(200, { 'Content-Type': 'video/mp4' }).end(Buffer.alloc(5000, 2))
    }
    send(res, 404, {})
  })
  try {
    const cacheDir = mkdtempSync(join(tmpdir(), 'yf-pxb-search-'))
    let clock = 1_000_000
    const c = createPixabayClient({ apiKey: () => 'PIXKEY', base: s.base, searchCacheDir: cacheDir, now: () => clock })
    const found = await c.search('  Ocean   Waves ')
    assert.equal(found[0].id, 9)
    assert.equal(seen[0].get('q'), 'Ocean Waves')
    assert.equal(seen[0].get('safesearch'), 'true')
    assert.equal(seen[0].get('video_type'), 'film')

    // Kueri sama (beda huruf besar) tidak memanggil API lagi; klien baru pun membaca cache disk.
    await c.search('ocean waves')
    const fresh = createPixabayClient({ apiKey: () => 'PIXKEY', base: s.base, searchCacheDir: cacheDir, now: () => clock })
    assert.equal((await fresh.search('OCEAN WAVES'))[0].id, 9)
    assert.equal(searches, 1, 'hasil dari cache')
    // Lewat 24 jam: cari ulang.
    clock += SEARCH_CACHE_MS
    await fresh.search('ocean waves')
    assert.equal(searches, 2)

    // Batas per menit dengan reset singkat: tunggu lalu ulang sekali.
    mode = 'rate-once'
    assert.equal((await c.search('forest')).length, 1)
    mode = 'rate'
    await assert.rejects(c.search('desert'), (e: unknown) => e instanceof StockError && e.kind === 'quota')
    mode = 'bad'
    await assert.rejects(c.search('mountain'), (e: unknown) => e instanceof StockError && e.kind === 'bad')
    mode = 'ok'

    await assert.rejects(createPixabayClient({ apiKey: () => 'SALAH', base: s.base }).search('x'), (e: unknown) => e instanceof StockError && e.kind === 'key')
    await assert.rejects(createPixabayClient({ apiKey: () => undefined, base: s.base }).search('x'), (e: unknown) => e instanceof StockError && e.kind === 'key')

    const dir = mkdtempSync(join(tmpdir(), 'yf-pxb-'))
    const p1 = await c.download(found[0], dir)
    assert.match(p1, /pixabay-9\.mp4$/)
    assert.equal(readFileSync(p1)[0], 2)
    assert.equal(await c.download(found[0], dir), p1)
    assert.equal(downloads, 1, 'unduhan kedua memakai cache')
  } finally {
    s.close()
  }
})

test('groq: daftar model teks saja, JSON mode, key Bearer, error terklasifikasi, tunggu retry-after singkat', async () => {
  let seen: { auth?: string; body?: Record<string, unknown> } = {}
  let mode: 'ok' | 'rate-once' | 'rate-long' | 'gone' = 'ok'
  const s = await serve((req, body, res) => {
    if (req.headers.authorization !== 'Bearer GROQKEY') return send(res, 401, { error: { message: 'Invalid API Key' } })
    if (req.url === '/models')
      return send(res, 200, { data: [{ id: 'llama-3.3-70b-versatile', active: true }, { id: 'whisper-large-v3', active: true }, { id: 'meta-llama/llama-guard-4-12b' }, { id: 'old-model', active: false }, { id: 'openai/gpt-oss-120b' }] })
    if (req.url === '/chat/completions') {
      if (mode === 'rate-once' || mode === 'rate-long') {
        const long = mode === 'rate-long'
        if (mode === 'rate-once') mode = 'ok'
        return void res.writeHead(429, { 'Content-Type': 'application/json', 'retry-after': long ? '120' : '0.05' }).end('{}')
      }
      if (mode === 'gone') return send(res, 404, { error: { message: 'model not found', code: 'model_not_found' } })
      seen = { auth: req.headers.authorization, body: JSON.parse(body) }
      return send(res, 200, { choices: [{ message: { content: '```json\n{"topics":["a"]}\n```' } }] })
    }
    send(res, 404, {})
  })
  try {
    const c = createGroqClient({ apiKey: () => 'GROQKEY', base: s.base, retryDelayMs: 5 })
    assert.deepEqual(await c.listModels(), ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'])
    assert.deepEqual(await c.completeJson({ model: 'llama-3.3-70b-versatile', system: 'sys JSON', user: 'u' }), { topics: ['a'] })
    assert.deepEqual(seen.body?.response_format, { type: 'json_object' })
    assert.deepEqual((seen.body?.messages as { role: string }[]).map((m) => m.role), ['system', 'user'])

    mode = 'rate-once'
    assert.deepEqual(await c.completeJson({ model: 'm', system: 's', user: 'u' }), { topics: ['a'] })
    mode = 'rate-long'
    await assert.rejects(c.completeJson({ model: 'm', system: 's', user: 'u' }), (e: unknown) => e instanceof GroqError && e.kind === 'quota')
    mode = 'gone'
    await assert.rejects(c.completeJson({ model: 'm', system: 's', user: 'u' }), /tidak ditemukan/)
    await assert.rejects(createGroqClient({ apiKey: () => 'SALAH', base: s.base }).listModels(), (e: unknown) => e instanceof GroqError && e.kind === 'key')
    await assert.rejects(createGroqClient({ apiKey: () => undefined, base: s.base }).listModels(), /belum diisi/)
  } finally {
    s.close()
  }
})

test('deepgram: /speak dengan model dan format WAV, error terklasifikasi', async () => {
  let seen: URLSearchParams | null = null
  let status = 200
  const s = await serve((req, body, res) => {
    const u = new URL(req.url!, 'http://x')
    if (req.headers.authorization !== 'Token DGKEY') return send(res, 401, { err_msg: 'Invalid credentials.' })
    if (status !== 200) return send(res, status, { err_msg: 'Model tidak ada' })
    seen = u.searchParams
    assert.deepEqual(JSON.parse(body), { text: 'Halo dunia.' })
    return void res.writeHead(200, { 'Content-Type': 'audio/wav' }).end(pcmToWav(Buffer.alloc(4800), 24000))
  })
  try {
    const dg = createDeepgramTts({ apiKey: () => 'DGKEY', base: s.base, retryDelayMs: 5 })
    const wav = await dg.speak({ model: 'aura-2-thalia-en', text: '  Halo   dunia. ' })
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
    assert.equal(seen!.get('model'), 'aura-2-thalia-en')
    assert.equal(seen!.get('container'), 'wav')
    assert.equal(seen!.get('encoding'), 'linear16')

    await assert.rejects(dg.speak({ model: 'bukan model; rm', text: 'x' }), /tidak dikenal/)
    await assert.rejects(createDeepgramTts({ apiKey: () => 'SALAH', base: s.base }).speak({ model: 'aura-2-thalia-en', text: 'x' }), (e: unknown) => e instanceof DeepgramError && e.kind === 'key')
    status = 402
    await assert.rejects(dg.speak({ model: 'aura-2-thalia-en', text: 'Halo dunia.' }), (e: unknown) => e instanceof DeepgramError && e.kind === 'quota')
    status = 400
    await assert.rejects(dg.speak({ model: 'aura-2-thalia-en', text: 'Halo dunia.' }), /Model tidak ada/)
  } finally {
    s.close()
  }
})

test('languages: satuan ucap, pemenggal kata, dan dukungan suara per bahasa', () => {
  assert.equal(speechUnits('satu dua  tiga', 'id'), 3)
  assert.equal(speechUnits('深海には、秘密。', 'ja'), 6)
  assert.deepEqual(splitWords('  Halo   dunia ', 'id'), ['Halo', 'dunia'])
  const ja = splitWords('深海には、秘密がある。', 'ja')
  assert.equal(ja.join(''), '深海には、秘密がある。')
  assert.ok(ja.every((w) => !/^[、。]/.test(w)), 'tanda baca menempel ke kata sebelumnya')
  assert.ok(voiceSourceSupports('gemini-tts', 'th'))
  assert.ok(voiceSourceSupports('deepgram', 'en') && !voiceSourceSupports('deepgram', 'id'))
  assert.ok(voiceSourceSupports('piper', 'id', ['id', 'en']) && !voiceSourceSupports('piper', 'ja', ['id', 'en']))
  assert.equal(languageInfo('zz').code, 'id')
  assert.ok(DEEPGRAM_VOICES.en!.every((v) => /^aura-2-[a-z]+-en$/.test(v.id)))
})
