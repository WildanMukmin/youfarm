import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GeminiError, createGeminiClient, parseJsonLoose, pcmToWav } from '../../src/main/platform/ai/gemini-client.ts'
import { PexelsError, createPexelsClient, normalizeVideos, pickFile, pickVideo, type StockVideo } from '../../src/main/platform/ai/pexels-client.ts'

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

test('pexels: pickVideo menghindari yang sudah dipakai dan memilih yang vertikal serta cukup panjang', () => {
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

    await assert.rejects(createPexelsClient({ apiKey: () => 'SALAH', base: s.base }).search('x'), (e: unknown) => e instanceof PexelsError && e.kind === 'key')
    await assert.rejects(createPexelsClient({ apiKey: () => undefined, base: s.base }).search('x'), (e: unknown) => e instanceof PexelsError && e.kind === 'key')
    mode = 429
    await assert.rejects(c.search('x'), (e: unknown) => e instanceof PexelsError && e.kind === 'quota')
  } finally {
    s.close()
  }
})
