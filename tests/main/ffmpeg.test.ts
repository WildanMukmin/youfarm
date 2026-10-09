import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFfmpeg, FfmpegError } from '../../src/main/platform/ffmpeg.ts'
import { ProcessCancelledError, spawnProcess } from '../../src/main/platform/spawn-process.ts'

const BIN = join(import.meta.dirname, '../../binaries/win-x64')
const hasFfmpeg = existsSync(join(BIN, 'ffmpeg.exe')) && existsSync(join(BIN, 'ffprobe.exe'))
const skip = hasFfmpeg ? false : 'ffmpeg belum terpasang (npm run setup:ffmpeg)'
const tmp = (): string => mkdtempSync(join(tmpdir(), 'yf-ff-'))

test('spawnProcess: keluaran, kode keluar, dan pembatalan', async () => {
  const ok = await spawnProcess(process.execPath, ['-e', 'console.log("halo"); console.error("peringatan")'])
  assert.equal(ok.code, 0)
  assert.equal(ok.stdout.trim(), 'halo')
  assert.match(ok.stderrTail, /peringatan/)

  const bad = await spawnProcess(process.execPath, ['-e', 'process.exit(3)'])
  assert.equal(bad.code, 3)

  const ac = new AbortController()
  const p = spawnProcess(process.execPath, ['-e', 'setTimeout(()=>{}, 60000)'], { signal: ac.signal })
  setTimeout(() => ac.abort(), 100)
  await assert.rejects(p, ProcessCancelledError)

  const already = new AbortController()
  already.abort()
  await assert.rejects(spawnProcess(process.execPath, ['-e', ''], { signal: already.signal }), ProcessCancelledError)
})

test('spawnProcess: baris stdout dikirim satu per satu', async () => {
  const lines: string[] = []
  await spawnProcess(process.execPath, ['-e', 'process.stdout.write("a\\nb\\nc")'], { onStdoutLine: (l) => lines.push(l) })
  assert.deepEqual(lines.slice(0, 2), ['a', 'b'])
})

test('ffmpeg: render, progres, durasi, dan ukuran', { skip }, async () => {
  const ff = createFfmpeg(BIN)
  const out = join(tmp(), 'a.mp4')
  const progress: number[] = []
  await ff.run(['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=2', '-pix_fmt', 'yuv420p', out], { onProgress: (s) => progress.push(s) })
  assert.ok(statSync(out).size > 0)
  assert.ok(progress.length > 0 && Math.max(...progress) > 1.5)
  assert.ok(Math.abs((await ff.duration(out)) - 2) < 0.2)
  assert.deepEqual(await ff.size(out), { width: 320, height: 240 })
})

test('ffmpeg: argumen salah memberi error dengan ekor stderr; bisa dibatalkan', { skip }, async () => {
  const ff = createFfmpeg(BIN)
  await assert.rejects(ff.run(['-i', 'tidak-ada.mp4', join(tmp(), 'x.mp4')]), (e: unknown) => e instanceof FfmpegError && /tidak-ada/.test(e.stderrTail))

  const ac = new AbortController()
  const p = ff.run(['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=600', '-f', 'null', '-'], { signal: ac.signal })
  setTimeout(() => ac.abort(), 400)
  await assert.rejects(p, ProcessCancelledError)
})
