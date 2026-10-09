import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFootageLibrary, clipKey } from '../../src/main/platform/footage-library.ts'
import { MIGRATIONS } from '../../src/main/platform/migrations.ts'
import { openSqlite } from '../../src/main/platform/sqlite.ts'

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'yf-lib-'))
  const db = await openSqlite(join(dir, 'db.sqlite'), MIGRATIONS)
  let t = Date.parse('2026-06-01T10:00:00.000Z')
  const lib = createFootageLibrary({ db, dirFor: (p) => join(dir, 'import', p), now: () => new Date((t += 1000)) })
  const file = (provider: string, id: number, bytes = 1000): string => {
    mkdirSync(join(dir, 'import', provider), { recursive: true })
    const p = join(dir, 'import', provider, `${provider}-${id}.mp4`)
    writeFileSync(p, Buffer.alloc(bytes))
    return p
  }
  const video = (id: number) => ({ id, duration: 8, width: 1080, height: 1920 })
  return { dir, db, lib, file, video, close: () => (db.close(), rmSync(dir, { recursive: true, force: true })) }
}

test('library: dicatat, dipilih bila cukup kandidat cocok, dan dihindari setelah baru dipakai', async () => {
  const t = await setup()
  try {
    const seq1 = t.lib.beginVideo()
    for (const id of [1, 2, 3]) await t.lib.use('pixabay', t.video(id), t.file('pixabay', id), 'deep ocean', seq1)
    await t.lib.use('pixabay', t.video(4), t.file('pixabay', 4), 'forest trail', seq1)
    assert.deepEqual(t.lib.stats(), { count: 4, bytes: 4000 })

    // Video berikutnya: tiga klip laut baru dipakai, jadi belum ada kandidat; klip hutan tidak cocok.
    const seq2 = t.lib.beginVideo()
    const args = { neededSec: 5, used: new Set<number>(), seq: seq2, rng: () => 0 }
    assert.equal(t.lib.pick('pixabay', ['deep ocean'], args), null)
    assert.equal(t.lib.recentIds('pixabay', seq2).size, 4)

    // Cadangan (API gagal): yang baru dipakai boleh.
    assert.ok(t.lib.pick('pixabay', ['deep ocean'], { ...args, relaxed: true }))

    // Setelah 10 video lagi, ketiga klip laut kembali jadi kandidat.
    let seq = seq2
    for (let i = 0; i < 10; i++) seq = t.lib.beginVideo()
    const later = t.lib.pick('pixabay', ['deep ocean'], { ...args, seq })
    assert.ok(later && [1, 2, 3].includes(later.id))
    assert.equal(t.lib.pick('pixabay', ['deep ocean'], { ...args, seq, used: new Set([1, 2]) }), null, 'tinggal satu kandidat: terlalu sedikit')
    assert.equal(t.lib.pick('pexels', ['deep ocean'], { ...args, seq }), null, 'penyedia lain terpisah')
  } finally {
    t.close()
  }
})

test('library: berkas yang dihapus pengguna dilupakan, tidak dipakai', async () => {
  const t = await setup()
  try {
    for (const id of [1, 2, 3]) await t.lib.use('pixabay', t.video(id), t.file('pixabay', id), 'deep ocean', 1)
    rmSync(join(t.dir, 'import', 'pixabay', 'pixabay-2.mp4'))
    const picked = t.lib.pick('pixabay', ['deep ocean'], { neededSec: 5, used: new Set(), seq: 50, rng: () => 0, relaxed: true })
    assert.ok(picked && picked.id !== 2)
    assert.equal(t.lib.stats().count, 2)
  } finally {
    t.close()
  }
})

test('library: prune membuang yang paling lama tidak dipakai, kecuali klip video ini', async () => {
  const t = await setup()
  try {
    await t.lib.use('pixabay', t.video(1), t.file('pixabay', 1, 1000), 'a', 1)
    await t.lib.use('pixabay', t.video(2), t.file('pixabay', 2, 1000), 'b', 2)
    await t.lib.use('pixabay', t.video(3), t.file('pixabay', 3, 1000), 'c', 3)
    assert.equal(await t.lib.prune(5000, new Set()), 0, 'di bawah batas')
    const removed = await t.lib.prune(1500, new Set([clipKey('pixabay', 1)]))
    assert.equal(removed, 2)
    assert.ok(existsSync(join(t.dir, 'import', 'pixabay', 'pixabay-1.mp4')), 'klip yang sedang dipakai aman walau paling lama')
    assert.ok(!existsSync(join(t.dir, 'import', 'pixabay', 'pixabay-2.mp4')))
    assert.deepEqual(t.lib.stats(), { count: 1, bytes: 1000 })
  } finally {
    t.close()
  }
})

test('library: clear hanya menghapus klip tercatat; cache lama dipindah ke pustaka', async () => {
  const t = await setup()
  try {
    await t.lib.use('pixabay', t.video(1), t.file('pixabay', 1), 'a', 1)
    const stranger = join(t.dir, 'import', 'pixabay', 'catatan-saya.txt')
    writeFileSync(stranger, 'jangan hapus')
    assert.equal(await t.lib.clear(), 1)
    assert.ok(existsSync(stranger), 'berkas lain di folder tidak disentuh')
    assert.equal(t.lib.stats().count, 0)

    const legacy = join(t.dir, 'cache')
    mkdirSync(legacy)
    writeFileSync(join(legacy, 'pixabay-77.mp4'), Buffer.alloc(500))
    writeFileSync(join(legacy, 'pexels-5.mp4'), Buffer.alloc(300))
    writeFileSync(join(legacy, 'acak.txt'), 'x')
    assert.equal(await t.lib.adoptLegacy(legacy), 2)
    assert.ok(existsSync(join(t.dir, 'import', 'pixabay', 'pixabay-77.mp4')) && !existsSync(join(legacy, 'pixabay-77.mp4')))
    assert.deepEqual(t.lib.stats(), { count: 2, bytes: 800 })
    assert.ok(existsSync(join(legacy, 'acak.txt')))
  } finally {
    t.close()
  }
})
