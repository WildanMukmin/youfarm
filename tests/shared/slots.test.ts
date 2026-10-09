import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SLOTS, MAX_SLOTS, accountInfos, setAccountSlots, type StoredYoutube } from '../../src/shared/youtube/accounts.ts'
import type { QueueItem } from '../../src/shared/youtube/queue.ts'
import { occupiedSlots, suggestSlot, upcomingSlots } from '../../src/renderer/src/lib/slots.ts'
import { nextAiring } from '../../src/renderer/src/lib/queueView.ts'

const store: StoredYoutube = {
  clientId: 'c',
  accounts: { UC1: { channel: { id: 'UC1', title: 'Satu' }, refreshToken: 'x', connectedAt: '2026-10-01T00:00:00Z', scopes: [] } }
}

const item = (id: number, over: Partial<QueueItem>): QueueItem => ({
  id,
  channelId: 'UC1',
  mode: 'fakta-unik',
  template: null,
  title: `V${id}`,
  status: 'queued',
  publishAt: null,
  attempts: 0,
  notBefore: null,
  errorKind: null,
  errorMessage: null,
  warning: null,
  videoId: null,
  createdAt: '',
  updatedAt: '',
  ...over
})

test('jam tayang: bawaan bila belum diatur, disimpan rapi, ditolak bila kosong/kebanyakan/channel hilang', () => {
  assert.deepEqual(accountInfos(store)[0].slots, DEFAULT_SLOTS)

  const s = setAccountSlots(store, 'UC1', ['19:00', '12:00', '19:00', '25:00', 'x', 7])
  assert.deepEqual(accountInfos(s)[0].slots, ['12:00', '19:00'])
  assert.equal(store.accounts!.UC1.slots, undefined, 'input tidak diubah')

  assert.throws(() => setAccountSlots(store, 'UC1', []), /minimal satu/)
  assert.throws(() => setAccountSlots(store, 'UC1', 'bukan daftar'), /minimal satu/)
  const many = Array.from({ length: MAX_SLOTS + 1 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  assert.throws(() => setAccountSlots(store, 'UC1', many), /Maksimal/)
  assert.throws(() => setAccountSlots(store, 'UC9', ['12:00']), /tidak ada/)
})

test('suggestSlot: satu jam setelah slot terakhir, tidak bentrok, melewati tengah malam', () => {
  assert.equal(suggestSlot(['12:00', '19:00']), '20:00')
  assert.equal(suggestSlot(['23:00']), '00:00')
  assert.equal(suggestSlot([]), '19:00')
  assert.equal(suggestSlot(['19:00', '20:00']), '21:00')
})

test('slot terpakai per channel mengabaikan item gagal dan channel lain', () => {
  const items = [
    item(1, { publishAt: '2026-10-09T05:00:00Z' }),
    item(2, { publishAt: '2026-10-09T12:00:00Z', status: 'failed' }),
    item(3, { publishAt: '2026-10-09T00:00:00Z', channelId: 'UC2' }),
    item(4, { publishAt: '2026-10-09T10:00:00Z', status: 'done' })
  ]
  assert.deepEqual(occupiedSlots(items, 'UC1'), ['2026-10-09T05:00:00Z', '2026-10-09T10:00:00Z'])
  const next = upcomingSlots(['12:00', '19:00'], items, 'UC1', 2, new Date('2026-10-08T10:00:00Z'))
  assert.equal(next.length, 2)
  assert.ok(next.every((s) => !occupiedSlots(items, 'UC1').includes(s)))
})

test('nextAiring: jadwal terdekat di masa depan, abaikan gagal dan yang sudah lewat', () => {
  const now = new Date('2026-10-09T03:00:00Z')
  const items = [
    item(1, { publishAt: '2026-10-09T02:00:00Z', status: 'done' }),
    item(2, { publishAt: '2026-10-09T05:00:00Z', status: 'failed' }),
    item(3, { publishAt: '2026-10-09T12:00:00Z', status: 'done' }),
    item(4, { publishAt: '2026-10-09T07:00:00Z' }),
    item(5, {})
  ]
  assert.equal(nextAiring(items, now)?.id, 4)
  assert.equal(nextAiring([item(1, {})], now), null)
})
