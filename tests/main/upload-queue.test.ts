import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MIGRATIONS } from '../../src/main/platform/migrations.ts'
import { openSqlite } from '../../src/main/platform/sqlite.ts'
import { createUploadQueue, type Outcome } from '../../src/main/youtube/upload-queue.ts'
import { YoutubeApiError, type uploadVideo } from '../../src/main/youtube/upload.ts'
import type { UploadInput } from '../../src/shared/youtube/metadata.ts'
import type { EnqueueRequest } from '../../src/shared/youtube/queue.ts'

const input: UploadInput = {
  title: 'Video uji',
  description: 'd',
  tags: ['a'],
  categoryId: '27',
  madeForKids: false,
  containsSyntheticMedia: true,
  privacy: 'private'
}
const req = (over: Partial<EnqueueRequest> = {}): EnqueueRequest => ({
  channelId: 'UC1',
  mode: 'fakta-unik',
  template: null,
  filePath: 'video.mp4',
  thumbnailPath: null,
  playlistId: null,
  input,
  ...over
})

type Uploader = typeof uploadVideo

async function setup(opts: { uploader?: Uploader; accessToken?: (c: string) => Promise<string>; start?: string } = {}) {
  const db = await openSqlite(join(mkdtempSync(join(tmpdir(), 'yf-q-')), 'q.db'), MIGRATIONS)
  let t = new Date(opts.start ?? '2026-10-08T10:00:00Z')
  const calls: string[] = []
  const queue = createUploadQueue({
    db,
    apiBase: 'http://127.0.0.1:1',
    now: () => t,
    rand: () => 0.5,
    backoffMs: 60_000,
    accessToken: opts.accessToken ?? (async () => 'tok'),
    uploader:
      opts.uploader ??
      (async (p) => {
        calls.push(p.filePath)
        return { id: `v-${calls.length}`, privacy: 'private', publishAt: null }
      })
  })
  return { db, queue, calls, advance: (ms: number) => (t = new Date(t.getTime() + ms)), setNow: (iso: string) => (t = new Date(iso)) }
}

const statusOf = (s: Awaited<ReturnType<typeof setup>>, id: number) => s.queue.snapshot().items.find((i) => i.id === id)!

test('enqueue: judul kosong dan jadwal terlalu dekat ditolak sejak awal', async () => {
  const s = await setup()
  assert.throws(() => s.queue.enqueue(req({ input: { ...input, title: '  ' } })), /Judul/)
  assert.throws(() => s.queue.enqueue(req({ input: { ...input, publishAt: '2026-10-08T10:05:00Z' } })), /minimal 15 menit/)
  assert.equal(s.queue.snapshot().items.length, 0)
})

test('berhasil: status done dan video id tersimpan', async () => {
  const s = await setup()
  const id = s.queue.enqueue(req())
  assert.equal(await s.queue.processNext(), 'done')
  const item = statusOf(s, id)
  assert.equal(item.status, 'done')
  assert.equal(item.videoId, 'v-1')
  assert.ok(!('quota' in s.queue.snapshot()), 'tidak ada hitungan kuota lokal')
  assert.equal(await s.queue.processNext(), 'idle')
})

test('urutan FIFO dan antrean kosong -> idle', async () => {
  const s = await setup()
  s.queue.enqueue(req({ filePath: 'a.mp4' }))
  s.queue.enqueue(req({ filePath: 'b.mp4' }))
  await s.queue.processNext()
  await s.queue.processNext()
  assert.deepEqual(s.calls, ['a.mp4', 'b.mp4'])
})

test('tanpa batas lokal: 20 upload sehari jalan semua', async () => {
  const s = await setup()
  for (let i = 0; i < 20; i++) s.queue.enqueue(req({ filePath: `f${i}.mp4` }))
  for (let i = 0; i < 20; i++) assert.equal(await s.queue.processNext(), 'done')
  assert.equal(s.calls.length, 20)
})

test('batas project dari Google: semua yang antre menunggu sampai reset Pasifik, lalu lanjut', async () => {
  let refuse = true
  const s = await setup({
    uploader: async (p) => {
      if (refuse) throw new YoutubeApiError(403, 'quotaExceeded')
      return { id: p.filePath, privacy: 'private', publishAt: null }
    }
  })
  const a = s.queue.enqueue(req({ channelId: 'UC1', filePath: 'a.mp4' }))
  const b = s.queue.enqueue(req({ channelId: 'UC2', filePath: 'b.mp4' }))
  assert.equal(await s.queue.processNext(), 'quota')
  // 08 Okt 10:00 UTC = 03:00 PDT; reset berikutnya tengah malam PDT = 09 Okt 07:00 UTC.
  for (const id of [a, b]) {
    assert.equal(statusOf(s, id).status, 'queued')
    assert.equal(statusOf(s, id).notBefore, '2026-10-09T07:00:00.000Z')
    assert.equal(statusOf(s, id).errorKind, 'quota')
  }
  assert.equal(await s.queue.processNext(), 'idle', 'tidak mencoba lagi sebelum reset')

  refuse = false
  s.setNow('2026-10-09T07:01:00Z')
  assert.equal(await s.queue.processNext(), 'done')
  assert.equal(await s.queue.processNext(), 'done')
  assert.equal(statusOf(s, a).errorKind, null)
})

test('batas upload per channel: hanya channel itu yang menunggu', async () => {
  const s = await setup({
    uploader: async (p) => {
      if (p.filePath.startsWith('uc1')) throw new YoutubeApiError(400, 'uploadLimitExceeded')
      return { id: p.filePath, privacy: 'private', publishAt: null }
    }
  })
  const a1 = s.queue.enqueue(req({ channelId: 'UC1', filePath: 'uc1-a.mp4' }))
  const a2 = s.queue.enqueue(req({ channelId: 'UC1', filePath: 'uc1-b.mp4' }))
  const b1 = s.queue.enqueue(req({ channelId: 'UC2', filePath: 'uc2-a.mp4' }))
  assert.equal(await s.queue.processNext(), 'quota')
  assert.ok(statusOf(s, a1).notBefore && statusOf(s, a2).notBefore)
  assert.equal(statusOf(s, b1).notBefore, null)
  assert.equal(await s.queue.processNext(), 'done')
  assert.equal(statusOf(s, b1).status, 'done')
})

test('rate limit sesaat dicoba lagi sebentar, bukan menunggu sampai besok', async () => {
  const s = await setup({
    uploader: async () => {
      throw new YoutubeApiError(403, 'rateLimitExceeded')
    }
  })
  const id = s.queue.enqueue(req())
  assert.equal(await s.queue.processNext(), 'retry')
  const wait = new Date(statusOf(s, id).notBefore!).getTime() - new Date('2026-10-08T10:00:00Z').getTime()
  assert.ok(wait > 0 && wait <= 60 * 60_000, `jeda ${wait} ms`)
})

test('gangguan sementara: jeda bertingkat, lalu gagal setelah 5 percobaan', async () => {
  const s = await setup({
    uploader: async () => {
      throw new YoutubeApiError(503, '')
    }
  })
  const id = s.queue.enqueue(req())
  assert.equal(await s.queue.processNext(), 'retry')
  assert.equal(statusOf(s, id).status, 'queued')
  assert.ok(statusOf(s, id).notBefore, 'harus ada jeda sebelum dicoba lagi')
  assert.equal(await s.queue.processNext(), 'idle', 'belum waktunya')

  const outcomes: Outcome[] = []
  for (let i = 0; i < 4; i++) {
    s.advance(24 * 3600_000)
    outcomes.push(await s.queue.processNext())
  }
  assert.deepEqual(outcomes, ['retry', 'retry', 'retry', 'failed'])
  const item = statusOf(s, id)
  assert.equal(item.status, 'failed')
  assert.equal(item.attempts, 5)
  assert.equal(item.errorKind, 'retry')
})

test('item bermasalah: gagal, tidak menahan item lain, bisa dicoba lagi', async () => {
  let bad = true
  const s = await setup({
    uploader: async (p) => {
      if (bad && p.filePath === 'rusak.mp4') throw new YoutubeApiError(400, 'invalidTitle')
      return { id: 'ok', privacy: 'private', publishAt: null }
    }
  })
  const a = s.queue.enqueue(req({ filePath: 'rusak.mp4' }))
  const b = s.queue.enqueue(req({ filePath: 'bagus.mp4' }))
  assert.equal(await s.queue.processNext(), 'failed')
  assert.equal(await s.queue.processNext(), 'done')
  assert.equal(statusOf(s, a).status, 'failed')
  assert.equal(statusOf(s, a).errorKind, 'item')
  assert.equal(statusOf(s, b).status, 'done')

  bad = false
  s.queue.retry(a)
  assert.equal(statusOf(s, a).status, 'queued')
  assert.equal(await s.queue.processNext(), 'done')
})

test('akun bermasalah: semua item kanal itu diblokir, kanal lain jalan, lepas blokir setelah hubungkan ulang', async () => {
  const s = await setup({
    accessToken: async (c) => {
      if (c === 'UC1') throw Object.assign(new Error('Akses akun ini sudah dicabut.'), { tokenDead: true })
      return 'tok'
    }
  })
  const a1 = s.queue.enqueue(req({ channelId: 'UC1', filePath: 'a1.mp4' }))
  const a2 = s.queue.enqueue(req({ channelId: 'UC1', filePath: 'a2.mp4' }))
  const b1 = s.queue.enqueue(req({ channelId: 'UC2', filePath: 'b1.mp4' }))

  assert.equal(await s.queue.processNext(), 'blocked')
  assert.equal(statusOf(s, a1).status, 'blocked')
  assert.equal(statusOf(s, a2).status, 'blocked')
  assert.equal(statusOf(s, a1).errorKind, 'account')

  assert.equal(await s.queue.processNext(), 'done')
  assert.equal(statusOf(s, b1).status, 'done')
  assert.equal(s.calls.includes('a1.mp4'), false, 'tidak ada upload untuk akun yang diblokir')

  s.queue.unblockChannel('UC1')
  assert.equal(statusOf(s, a1).status, 'queued')
  assert.equal(statusOf(s, a2).status, 'queued')
})

test('jaringan putus saat mengambil token dianggap sementara, bukan akun rusak', async () => {
  const s = await setup({
    accessToken: async () => {
      throw new Error('Tidak bisa terhubung ke Google.')
    }
  })
  const id = s.queue.enqueue(req())
  assert.equal(await s.queue.processNext(), 'retry')
  assert.equal(statusOf(s, id).status, 'queued')
})

test('aplikasi ditutup saat uploading: item kembali ke antrean', async () => {
  const s = await setup()
  const id = s.queue.enqueue(req())
  s.db.run("UPDATE uploads SET status = 'uploading' WHERE id = ?", [id])
  assert.equal(s.queue.recoverInterrupted(), 1)
  assert.equal(statusOf(s, id).status, 'queued')
  assert.equal(await s.queue.processNext(), 'done')
})

test('thumbnail dan playlist gagal: video tetap done dengan peringatan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yf-th-'))
  const thumb = join(dir, 't.jpg')
  writeFileSync(thumb, Buffer.alloc(100))
  const s = await setup()
  const id = s.queue.enqueue(req({ thumbnailPath: thumb, playlistId: 'PL1' }))
  assert.equal(await s.queue.processNext(), 'done')
  const item = statusOf(s, id)
  assert.equal(item.status, 'done')
  assert.match(item.warning ?? '', /Thumbnail tidak terpasang/)
  assert.match(item.warning ?? '', /playlist/)
})

test('jadwal sudah lewat saat giliran tiba: item gagal dengan pesan jelas', async () => {
  const s = await setup()
  const id = s.queue.enqueue(req({ input: { ...input, publishAt: '2026-10-08T11:00:00Z' } }))
  s.setNow('2026-10-08T12:00:00Z')
  assert.equal(await s.queue.processNext(), 'failed')
  assert.match(statusOf(s, id).errorMessage ?? '', /minimal 15 menit/)
})

test('remove: hapus item tapi tidak yang sedang uploading', async () => {
  const s = await setup()
  const a = s.queue.enqueue(req())
  const b = s.queue.enqueue(req())
  s.db.run("UPDATE uploads SET status = 'uploading' WHERE id = ?", [b])
  s.queue.remove(a)
  s.queue.remove(b)
  assert.deepEqual(s.queue.snapshot().items.map((i) => i.id), [b])
})
