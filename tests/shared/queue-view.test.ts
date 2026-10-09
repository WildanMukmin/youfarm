import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterQueue, queueCounts, sortQueue } from '../../src/renderer/src/lib/queueView.ts'
import type { QueueItem } from '../../src/shared/youtube/queue.ts'

const mk = (id: number, status: QueueItem['status'], over: Partial<QueueItem> = {}): QueueItem => ({
  id,
  channelId: 'UC1',
  mode: 'fakta-unik',
  template: null,
  title: `Video ${id}`,
  status,
  publishAt: null,
  attempts: 0,
  notBefore: null,
  errorKind: null,
  errorMessage: null,
  warning: null,
  videoId: null,
  createdAt: '2026-10-09T01:00:00Z',
  updatedAt: '2026-10-09T01:00:00Z',
  ...over
})

const items = [
  mk(1, 'done', { updatedAt: '2026-10-08T05:00:00Z' }),
  mk(2, 'queued'),
  mk(3, 'failed'),
  mk(4, 'uploading'),
  mk(5, 'done', { updatedAt: '2026-10-09T05:00:00Z' }),
  mk(6, 'queued', { channelId: 'UC2', title: 'Laut dalam' }),
  mk(7, 'blocked')
]

test('sortQueue: mengunggah, perlu tindakan, antre (giliran dulu), selesai (terbaru dulu)', () => {
  assert.deepEqual(sortQueue(items).map((i) => i.id), [4, 3, 7, 2, 6, 5, 1])
  assert.deepEqual(items.map((i) => i.id), [1, 2, 3, 4, 5, 6, 7], 'tidak mengubah input')
})

test('filterQueue: status, channel, dan pencarian judul atau nama channel', () => {
  const names = { UC1: 'Fakta Harian', UC2: 'Sains Singkat' }
  const ids = (f: Parameters<typeof filterQueue>[1]) => filterQueue(items, f).map((i) => i.id)
  assert.deepEqual(ids({ filter: 'pending', channelId: '', query: '', channelNames: names }), [2, 4, 6])
  assert.deepEqual(ids({ filter: 'attention', channelId: '', query: '', channelNames: names }), [3, 7])
  assert.deepEqual(ids({ filter: 'all', channelId: 'UC2', query: '', channelNames: names }), [6])
  assert.deepEqual(ids({ filter: 'all', channelId: '', query: 'LAUT', channelNames: names }), [6])
  assert.deepEqual(ids({ filter: 'all', channelId: '', query: 'sains', channelNames: names }), [6])
})

test('queueCounts: selesai hari ini dihitung dari awal hari', () => {
  const c = queueCounts(items, new Date('2026-10-09T00:00:00Z'))
  assert.deepEqual(c, { pending: 2, uploading: 1, attention: 2, doneToday: 1, done: 2 })
})
