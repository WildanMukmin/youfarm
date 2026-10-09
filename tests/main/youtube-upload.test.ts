import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { YoutubeApiError, addToPlaylist, setThumbnail, uploadVideo } from '../../src/main/youtube/upload.ts'
import { buildUploadBody } from '../../src/shared/youtube/metadata.ts'

const MB = 1024 * 1024
const NOW = new Date('2026-10-08T10:00:00Z')
const body = buildUploadBody(
  { title: 'Uji', description: 'd', tags: [], categoryId: '27', madeForKids: false, containsSyntheticMedia: true, privacy: 'private' },
  NOW
)

interface Fake {
  base: string
  server: Server
  s: {
    received: number
    puts: string[]
    failOnPut: number // PUT potongan ke-N (1-based) dijawab 503 sekali
    initStatus: number
    initReason: string
    sessionGone: boolean
    initBody: unknown
    thumb: { type: string; size: number } | null
    playlist: unknown
  }
}

async function readAll(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

async function startFake(): Promise<Fake> {
  const s: Fake['s'] = { received: 0, puts: [], failOnPut: 0, initStatus: 200, initReason: '', sessionGone: false, initBody: null, thumb: null, playlist: null }
  let chunkNo = 0
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const data = await readAll(req)
    const json = (code: number, b: unknown) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(b))

    if (url.pathname === '/upload/youtube/v3/videos') {
      if (req.headers.authorization !== 'Bearer TOK') return json(401, {})
      if (s.initStatus !== 200) return json(s.initStatus, { error: { errors: [{ reason: s.initReason }] } })
      s.initBody = JSON.parse(data.toString())
      return res.writeHead(200, { Location: `http://${req.headers.host}/session/1` }).end()
    }
    if (url.pathname === '/session/1') {
      if (s.sessionGone) return res.writeHead(404).end()
      const range = String(req.headers['content-range'])
      s.puts.push(range)
      const total = Number(range.split('/')[1])
      if (range.startsWith('bytes */')) {
        return s.received === 0 ? res.writeHead(308).end() : res.writeHead(308, { Range: `bytes=0-${s.received - 1}` }).end()
      }
      chunkNo++
      if (s.failOnPut === chunkNo) return res.writeHead(503).end()
      s.received += data.length
      if (s.received >= total) return json(200, { id: 'vid123', status: { privacyStatus: 'private' } })
      return res.writeHead(308, { Range: `bytes=0-${s.received - 1}` }).end()
    }
    if (url.pathname === '/upload/youtube/v3/thumbnails/set') {
      s.thumb = { type: String(req.headers['content-type']), size: data.length }
      return json(200, {})
    }
    if (url.pathname === '/youtube/v3/playlistItems') {
      s.playlist = JSON.parse(data.toString())
      return json(200, {})
    }
    json(404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { server, s, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
}

const close = (f: Fake): void => {
  f.server.close()
  f.server.closeAllConnections()
}

const tmpFile = (name: string, bytes: number): string => {
  const p = join(mkdtempSync(join(tmpdir(), 'yf-up-')), name)
  writeFileSync(p, Buffer.alloc(bytes, 7))
  return p
}

test('upload: berkas 3 MB dikirim per potongan 1 MB dan progres naik', async () => {
  const f = await startFake()
  try {
    const progress: number[] = []
    const v = await uploadVideo({ accessToken: 'TOK', filePath: tmpFile('a.mp4', 3 * MB), body, apiBase: f.base, chunkSize: MB, onProgress: (sent) => progress.push(sent) })
    assert.equal(v.id, 'vid123')
    assert.equal(v.privacy, 'private')
    assert.equal(f.s.received, 3 * MB)
    assert.deepEqual(f.s.puts, [`bytes 0-${MB - 1}/${3 * MB}`, `bytes ${MB}-${2 * MB - 1}/${3 * MB}`, `bytes ${2 * MB}-${3 * MB - 1}/${3 * MB}`])
    assert.deepEqual(progress, [0, MB, 2 * MB, 3 * MB])
    assert.equal((f.s.initBody as { status: { containsSyntheticMedia: boolean } }).status.containsSyntheticMedia, true)
  } finally {
    close(f)
  }
})

test('upload: putus di tengah (503) dilanjutkan dari byte terakhir, bukan diulang dari awal', async () => {
  const f = await startFake()
  try {
    f.s.failOnPut = 2
    const v = await uploadVideo({ accessToken: 'TOK', filePath: tmpFile('b.mp4', 3 * MB), body, apiBase: f.base, chunkSize: MB, retryDelayMs: 1 })
    assert.equal(v.id, 'vid123')
    assert.equal(f.s.received, 3 * MB)
    assert.ok(f.s.puts.some((r) => r.startsWith('bytes */')), 'harus menanyakan status sesi')
    assert.equal(f.s.puts.filter((r) => r === `bytes 0-${MB - 1}/${3 * MB}`).length, 1, 'potongan pertama tidak dikirim ulang')
  } finally {
    close(f)
  }
})

test('upload: kuota habis saat init -> error terklasifikasi quota', async () => {
  const f = await startFake()
  try {
    f.s.initStatus = 403
    f.s.initReason = 'quotaExceeded'
    await assert.rejects(
      uploadVideo({ accessToken: 'TOK', filePath: tmpFile('c.mp4', MB), body, apiBase: f.base }),
      (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'quota' && /Kuota/.test(e.message)
    )
  } finally {
    close(f)
  }
})

test('upload: token ditolak -> account; berkas kosong -> item; sesi hilang berulang -> retry', async () => {
  const f = await startFake()
  try {
    await assert.rejects(uploadVideo({ accessToken: 'SALAH', filePath: tmpFile('d.mp4', MB), body, apiBase: f.base }), (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'account')
    await assert.rejects(uploadVideo({ accessToken: 'TOK', filePath: tmpFile('e.mp4', 0), body, apiBase: f.base }), (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'item')
    f.s.sessionGone = true
    await assert.rejects(uploadVideo({ accessToken: 'TOK', filePath: tmpFile('f.mp4', MB), body, apiBase: f.base, chunkSize: MB, retryDelayMs: 1, maxRetries: 2 }), (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'retry')
  } finally {
    close(f)
  }
})

test('upload: dibatalkan lewat AbortSignal', async () => {
  const f = await startFake()
  try {
    const ac = new AbortController()
    ac.abort()
    await assert.rejects(uploadVideo({ accessToken: 'TOK', filePath: tmpFile('g.mp4', MB), body, apiBase: f.base, signal: ac.signal }), /dibatalkan/)
  } finally {
    close(f)
  }
})

test('thumbnail dan playlist: tipe, batas ukuran, dan body benar', async () => {
  const f = await startFake()
  try {
    await setThumbnail({ accessToken: 'TOK', videoId: 'vid123', filePath: tmpFile('t.jpg', 1000), apiBase: f.base })
    assert.deepEqual(f.s.thumb, { type: 'image/jpeg', size: 1000 })
    await assert.rejects(setThumbnail({ accessToken: 'TOK', videoId: 'v', filePath: tmpFile('t.gif', 10), apiBase: f.base }), (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'item')
    await assert.rejects(setThumbnail({ accessToken: 'TOK', videoId: 'v', filePath: tmpFile('big.png', 3 * MB), apiBase: f.base }), (e: unknown) => e instanceof YoutubeApiError && e.classified.kind === 'item')

    await addToPlaylist({ accessToken: 'TOK', playlistId: 'PL1', videoId: 'vid123', apiBase: f.base })
    assert.deepEqual(f.s.playlist, { snippet: { playlistId: 'PL1', resourceId: { kind: 'youtube#video', videoId: 'vid123' } } })
  } finally {
    close(f)
  }
})
