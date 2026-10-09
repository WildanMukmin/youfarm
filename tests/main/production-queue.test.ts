import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MIGRATIONS } from '../../src/main/platform/migrations.ts'
import { openSqlite } from '../../src/main/platform/sqlite.ts'
import { createProductionQueue, type ProductionResult, type Runner } from '../../src/main/production/queue-core.ts'
import { splitTopics, type PublishPlan } from '../../src/shared/production.ts'

const result = (title: string): ProductionResult => ({
  video: {
    filePath: `${title}.mp4`,
    thumbnailPath: null,
    captionPath: null,
    durationSec: 30,
    aspect: '9:16',
    mode: 'fakta-unik',
    template: null,
    title,
    script: '',
    syntheticMedia: true,
    language: 'id'
  },
  description: '',
  tags: [],
  warnings: []
})

const validate = (_mode: string, o: unknown) => {
  const topic = String((o as { topic?: string })?.topic ?? '').trim()
  if (topic.length < 3) throw new Error('Isi topik minimal 3 karakter.')
  return { options: { topic }, topic }
}

async function setup(runner: Runner, publish?: (r: ProductionResult, p: PublishPlan) => number) {
  const db = await openSqlite(join(mkdtempSync(join(tmpdir(), 'yf-prod-')), 'p.db'), MIGRATIONS)
  const q = createProductionQueue({ db, runners: { 'fakta-unik': runner }, validate, publish, now: () => new Date('2026-10-09T03:00:00Z') })
  const job = (id: number) => q.snapshot().items.find((i) => i.id === id)!
  return { db, q, job }
}

const ok: Runner = async (o) => result(`Judul ${(o as { topic: string }).topic}`)

test('splitTopics: satu per baris, rapikan spasi, buang kosong dan duplikat', () => {
  assert.deepEqual(splitTopics('fakta laut\n\n  sejarah   piramida \nFakta Laut\r\nkucing'), ['fakta laut', 'sejarah piramida', 'kucing'])
  assert.deepEqual(splitTopics('   '), [])
})

test('enqueue: batch divalidasi utuh; satu rusak membatalkan semua', async () => {
  const s = await setup(ok)
  assert.throws(() => s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'bagus' }, { topic: 'x' }], publish: null }), /minimal 3/)
  assert.equal(s.q.snapshot().items.length, 0)
  assert.throws(() => s.q.enqueue({ mode: 'kids', options: [{ topic: 'bagus' }], publish: null }), /belum bisa/)
  assert.throws(() => s.q.enqueue({ mode: 'fakta-unik', options: [], publish: null }), /Tidak ada/)
  assert.throws(() => s.q.enqueue({ mode: 'fakta-unik', options: Array.from({ length: 51 }, () => ({ topic: 'abc' })), publish: null }), /Maksimal 50/)
  const ids = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }, { topic: 'dua' }], publish: null })
  assert.equal(ids.length, 2)
  assert.deepEqual(ids.map((i) => s.job(i).status), ['queued', 'queued'])
})

test('diproses satu per satu sesuai urutan; judul dan durasi tersimpan; recentTitles untuk avoid', async () => {
  const order: string[] = []
  const s = await setup(async (o) => {
    order.push((o as { topic: string }).topic)
    return result(`Judul ${(o as { topic: string }).topic}`)
  })
  const [a, b] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }, { topic: 'dua' }], publish: null })
  assert.equal(await s.q.processNext(), 'done')
  assert.equal(await s.q.processNext(), 'done')
  assert.equal(await s.q.processNext(), 'idle')
  assert.deepEqual(order, ['satu', 'dua'])
  assert.equal(s.job(a).title, 'Judul satu')
  assert.equal(s.job(a).durationSec, 30)
  assert.equal(s.job(b).percent, 100)
  assert.deepEqual(s.q.recentTitles('fakta-unik'), ['Judul dua', 'Judul satu'])
  assert.equal(s.q.result(a)?.video.filePath, 'Judul satu.mp4')
})

test('progres langsung terlihat di snapshot selama berjalan', async () => {
  let release!: () => void
  const s = await setup(async (_o, onProgress) => {
    onProgress({ stage: 'render', percent: 64, message: 'Merender video…' })
    await new Promise<void>((r) => (release = r))
    return result('x')
  })
  const [id] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }], publish: null })
  const p = s.q.processNext()
  await new Promise((r) => setTimeout(r, 10))
  const j = s.job(id)
  assert.deepEqual([j.status, j.stage, j.percent, j.message], ['running', 'render', 64, 'Merender video…'])
  release()
  await p
  assert.equal(s.job(id).stage, null)
})

test('gagal: pesan tersimpan, bisa dicoba lagi; percobaan dihitung', async () => {
  let fail = true
  const s = await setup(async () => {
    if (fail) throw new Error('Key Gemini ditolak.')
    return result('ok')
  })
  const [id] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }], publish: null })
  assert.equal(await s.q.processNext(), 'failed')
  assert.equal(s.job(id).errorMessage, 'Key Gemini ditolak.')
  fail = false
  s.q.retry(id)
  assert.equal(s.job(id).status, 'queued')
  assert.equal(await s.q.processNext(), 'done')
  assert.equal(s.job(id).attempts, 2)
  assert.equal(s.job(id).errorMessage, null)
})

test('batal: yang antre langsung dibatalkan; yang berjalan dihentikan lewat AbortSignal', async () => {
  const s = await setup(
    (_o, _p, signal) =>
      new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('Pembuatan video dibatalkan.')), { once: true }))
  )
  const [a, b] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }, { topic: 'dua' }], publish: null })
  s.q.cancel(b)
  assert.equal(s.job(b).status, 'cancelled')
  const p = s.q.processNext()
  await new Promise((r) => setTimeout(r, 10))
  s.q.cancel(a)
  assert.equal(await p, 'cancelled')
  assert.equal(s.job(a).status, 'cancelled')
  s.q.retry(a)
  assert.equal(s.job(a).status, 'queued')
})

test('jeda saat berjalan: job dihentikan dan kembali antre (bukan dibatalkan)', async () => {
  const s = await setup(
    (_o, _p, signal) => new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('Proses dibatalkan.')), { once: true }))
  )
  const [id] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }], publish: null })
  s.q.start({ gapMs: 5, idleMs: 5 })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(s.job(id).status, 'running')
  s.q.stop()
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(s.job(id).status, 'queued')
  assert.equal(s.q.isRunning(), false)
})

test('aplikasi ditutup saat membuat: job kembali antre', async () => {
  const s = await setup(ok)
  const [id] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }], publish: null })
  s.db.run("UPDATE production_jobs SET status = 'running' WHERE id = ?", [id])
  assert.equal(s.q.recoverInterrupted(), 1)
  assert.equal(s.job(id).status, 'queued')
})

test('publikasi otomatis: video jadi masuk antrean upload; gagal masuk jadi peringatan, bukan kegagalan', async () => {
  const plans: PublishPlan[] = []
  let refuse = false
  const s = await setup(ok, (_r, plan) => {
    if (refuse) throw new Error('Channel ini belum punya jam tayang.')
    plans.push(plan)
    return 77
  })
  const plan: PublishPlan = { channelId: 'UC1', privacy: 'private', schedule: true }
  const [a] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }], publish: plan })
  await s.q.processNext()
  assert.equal(s.job(a).uploadId, 77)
  assert.deepEqual(s.job(a).publish, plan)
  assert.deepEqual(plans, [plan])

  refuse = true
  const [b] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'dua' }], publish: plan })
  assert.equal(await s.q.processNext(), 'done')
  assert.equal(s.job(b).status, 'done')
  assert.equal(s.job(b).uploadId, null)
  assert.match(s.job(b).warning ?? '', /belum masuk antrean upload/)

  const [c] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'tiga' }], publish: null })
  await s.q.processNext()
  assert.equal(s.job(c).uploadId, null)
  assert.equal(s.job(c).warning, null)
})

test('hapus: tidak bisa menghapus yang sedang berjalan', async () => {
  const s = await setup(ok)
  const [a, b] = s.q.enqueue({ mode: 'fakta-unik', options: [{ topic: 'satu' }, { topic: 'dua' }], publish: null })
  s.db.run("UPDATE production_jobs SET status = 'running' WHERE id = ?", [b])
  s.q.remove(a)
  s.q.remove(b)
  assert.deepEqual(s.q.snapshot().items.map((i) => i.id), [b])
})
