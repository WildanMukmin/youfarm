import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterProduction, productionCounts, sortProduction } from '../../src/renderer/src/lib/productionView.ts'
import type { ProductionJob } from '../../src/shared/production.ts'

const job = (id: number, status: ProductionJob['status'], over: Partial<ProductionJob> = {}): ProductionJob => ({
  id,
  mode: 'fakta-unik',
  topic: `topik ${id}`,
  status,
  stage: null,
  percent: 0,
  message: null,
  errorMessage: null,
  warning: null,
  title: null,
  durationSec: null,
  publish: null,
  uploadId: null,
  attempts: 0,
  createdAt: '2026-10-09T01:00:00Z',
  updatedAt: '2026-10-09T01:00:00Z',
  finishedAt: null,
  ...over
})

const items = [
  job(1, 'done', { updatedAt: '2026-10-09T02:00:00Z', finishedAt: '2026-10-09T02:00:00Z', title: 'Laut dalam' }),
  job(2, 'queued'),
  job(3, 'failed'),
  job(4, 'running'),
  job(5, 'queued'),
  job(6, 'cancelled', { updatedAt: '2026-10-09T03:00:00Z' }),
  job(7, 'done', { updatedAt: '2026-10-08T02:00:00Z', finishedAt: '2026-10-08T02:00:00Z' })
]

test('sortProduction: dibuat, gagal, antre (giliran dulu), jadi, dibatalkan', () => {
  assert.deepEqual(sortProduction(items).map((j) => j.id), [4, 3, 2, 5, 1, 7, 6])
})

test('filterProduction: status dan pencarian topik atau judul', () => {
  assert.deepEqual(filterProduction(items, 'active', '').map((j) => j.id), [2, 4, 5])
  assert.deepEqual(filterProduction(items, 'failed', '').map((j) => j.id), [3])
  assert.deepEqual(filterProduction(items, 'all', 'LAUT').map((j) => j.id), [1])
  assert.deepEqual(filterProduction(items, 'all', 'topik 5').map((j) => j.id), [5])
})

test('productionCounts: jadi hari ini dari waktu selesai', () => {
  assert.deepEqual(productionCounts(items, new Date('2026-10-09T00:00:00Z')), { queued: 2, running: 1, active: 3, failed: 1, doneToday: 1, done: 2 })
})
