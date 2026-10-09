import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageWindow, paginate } from '../../src/renderer/src/lib/paginate.ts'

const items = Array.from({ length: 23 }, (_, i) => i + 1)

test('paginate: potongan, rentang, dan halaman di luar batas dijepit', () => {
  assert.deepEqual(paginate(items, 1, 10), { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, pages: 3, from: 1, to: 10, total: 23 })
  const last = paginate(items, 3, 10)
  assert.deepEqual([last.items, last.from, last.to], [[21, 22, 23], 21, 23])
  assert.equal(paginate(items, 99, 10).page, 3)
  assert.equal(paginate(items, 0, 10).page, 1)
  assert.equal(paginate(items, Number.NaN, 10).page, 1)
  assert.deepEqual(paginate([], 1, 10), { items: [], page: 1, pages: 1, from: 0, to: 0, total: 0 })
})

test('pageWindow: tanpa elipsis bila sedikit, dengan elipsis bila banyak', () => {
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3])
  assert.deepEqual(pageWindow(1, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(pageWindow(6, 12), [1, 'gap', 5, 6, 7, 'gap', 12])
  assert.deepEqual(pageWindow(1, 12), [1, 2, 'gap', 12])
  assert.deepEqual(pageWindow(12, 12), [1, 'gap', 11, 12])
  assert.deepEqual(pageWindow(3, 12), [1, 2, 3, 4, 'gap', 12])
})
