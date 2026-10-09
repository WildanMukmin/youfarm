import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_KEYS_PER_PROVIDER,
  QUOTA_COOLDOWN_MS,
  addKey,
  cleanLabel,
  emptyRing,
  pickKey,
  removeKey,
  reportLimit,
  toInfo,
  type KeyRing,
  type StoredKey
} from '../../src/shared/api-keys.ts'

const key = (id: string, over: Partial<StoredKey> = {}): StoredKey => ({ id, label: id, last4: '1234', addedAt: '2026-01-01T00:00:00.000Z', limitedUntil: null, ...over })
const ring = (ids: string[], over: Partial<KeyRing> = {}): KeyRing => ({ activeId: ids[0] ?? null, auto: true, keys: ids.map((i) => key(i)), ...over })
const NOW = Date.parse('2026-06-01T10:00:00.000Z')

test('addKey: key pertama jadi aktif, batas jumlah dijaga', () => {
  const r = addKey(addKey(emptyRing(), key('a')), key('b'))
  assert.equal(r.activeId, 'a')
  assert.deepEqual(r.keys.map((k) => k.id), ['a', 'b'])
  let full = emptyRing()
  for (let i = 0; i < MAX_KEYS_PER_PROVIDER; i++) full = addKey(full, key(`k${i}`))
  assert.throws(() => addKey(full, key('lebih')), /Maksimal/)
})

test('removeKey: menghapus key aktif memindahkan pilihan ke key pertama yang tersisa', () => {
  assert.equal(removeKey(ring(['a', 'b', 'c']), 'a').activeId, 'b')
  assert.equal(removeKey(ring(['a', 'b'], { activeId: 'b' }), 'a').activeId, 'b')
  assert.equal(removeKey(ring(['a']), 'a').activeId, null)
})

test('pickKey: memakai key terpilih; key terpilih yang kena batas diganti hanya bila auto menyala', () => {
  const limited = (auto: boolean): KeyRing => ({
    ...ring(['a', 'b', 'c'], { auto }),
    keys: ring(['a', 'b', 'c']).keys.map((k) => (k.id === 'a' ? { ...k, limitedUntil: new Date(NOW + 60_000).toISOString() } : k))
  })
  assert.equal(pickKey(ring(['a', 'b']), NOW)?.id, 'a')
  assert.equal(pickKey(limited(true), NOW)?.id, 'b')
  assert.equal(pickKey(limited(false), NOW)?.id, 'a', 'auto mati: pilihan pengguna dihormati')
  assert.equal(pickKey(limited(true), NOW + 120_000)?.id, 'a', 'batas sudah lewat')
  assert.equal(pickKey(emptyRing(), NOW), null)
})

test('reportLimit: menandai key, memindah ke key siap berikutnya, dan berhenti bila semua kena batas', () => {
  const first = reportLimit(ring(['a', 'b', 'c']), 'a', NOW, QUOTA_COOLDOWN_MS)
  assert.equal(first.next?.id, 'b')
  assert.equal(first.ring.activeId, 'b')
  assert.equal(toInfo(first.ring, NOW).keys[0].limited, true)

  const second = reportLimit(first.ring, 'b', NOW, QUOTA_COOLDOWN_MS)
  assert.equal(second.next?.id, 'c')
  const third = reportLimit(second.ring, 'c', NOW, QUOTA_COOLDOWN_MS)
  assert.equal(third.next, null, 'semua key kena batas')
  assert.equal(third.ring.activeId, 'c')

  const manual = reportLimit(ring(['a', 'b'], { auto: false }), 'a', NOW, QUOTA_COOLDOWN_MS)
  assert.equal(manual.next, null)
  assert.equal(manual.ring.activeId, 'a')
})

test('toInfo: satu key aktif, tanda batas mengikuti waktu', () => {
  const r = reportLimit(ring(['a', 'b']), 'a', NOW, 1000).ring
  const early = toInfo(r, NOW)
  assert.deepEqual(early.keys.map((k) => [k.id, k.active, k.limited]), [['a', false, true], ['b', true, false]])
  assert.equal(toInfo(r, NOW + 5000).keys[0].limited, false)
})

test('cleanLabel: spasi dirapikan, dipotong, kosong memakai cadangan', () => {
  assert.equal(cleanLabel('  Akun   utama ', 'Key 1'), 'Akun utama')
  assert.equal(cleanLabel('   ', 'Key 2'), 'Key 2')
  assert.equal(cleanLabel(42, 'Key 3'), 'Key 3')
  assert.equal(cleanLabel('x'.repeat(100), 'k').length, 40)
})
