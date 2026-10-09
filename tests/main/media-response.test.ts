import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileResponse, parseRange } from '../../src/main/platform/media-response.ts'

test('parseRange: bentuk umum, akhiran, dan tidak valid', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=0-5000', 1000), { start: 0, end: 999 })
  assert.equal(parseRange('bytes=1000-', 1000), null)
  assert.equal(parseRange('bytes=5-2', 1000), null)
  assert.equal(parseRange('items=0-1', 1000), null)
  assert.equal(parseRange('bytes=-', 1000), null)
})

test('fileResponse: utuh, sebagian (206), di luar rentang (416), dan tidak ada (404)', async () => {
  const f = join(mkdtempSync(join(tmpdir(), 'yf-media-')), 'v.mp4')
  writeFileSync(f, Buffer.from(Array.from({ length: 256 }, (_, i) => i)))

  const full = await fileResponse(f, null)
  assert.equal(full.status, 200)
  assert.equal(full.headers.get('content-type'), 'video/mp4')
  assert.equal(full.headers.get('accept-ranges'), 'bytes')
  assert.equal((await full.arrayBuffer()).byteLength, 256)

  const part = await fileResponse(f, 'bytes=10-19')
  assert.equal(part.status, 206)
  assert.equal(part.headers.get('content-range'), 'bytes 10-19/256')
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19])

  const bad = await fileResponse(f, 'bytes=999-')
  assert.equal(bad.status, 416)
  assert.equal(bad.headers.get('content-range'), 'bytes */256')

  assert.equal((await fileResponse(join(f, '..', 'tidak-ada.mp4'), null)).status, 404)
})
