import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteVideoFiles } from '../../src/main/production/files.ts'

test('deleteVideoFiles: menghapus mp4, thumbnail, dan SRT; yang sudah hilang atau kosong diabaikan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yf-del-'))
  try {
    const [a, b, c] = ['v.mp4', 'v.jpg', 'v.srt'].map((n) => join(dir, n))
    for (const f of [a, b, c]) writeFileSync(f, 'x')
    writeFileSync(join(dir, 'lain.mp4'), 'x')
    await deleteVideoFiles([a, b, c, join(dir, 'tidak-ada.mp4'), null, undefined])
    assert.ok(!existsSync(a) && !existsSync(b) && !existsSync(c))
    assert.ok(existsSync(join(dir, 'lain.mp4')), 'berkas lain tidak disentuh')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('deleteVideoFiles: kegagalan melempar error jelas dan berkas lain tetap dihapus', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yf-del-'))
  try {
    const keep = join(dir, 'folder-berisi')
    mkdirSync(keep)
    writeFileSync(join(keep, 'isi.txt'), 'x')
    const ok = join(dir, 'v.mp4')
    writeFileSync(ok, 'x')
    // rm tanpa recursive pada folder berisi gagal; berkas sesudahnya tetap diproses.
    await assert.rejects(deleteVideoFiles([keep, ok]), /Gagal menghapus berkas|sedang dipakai/)
    assert.ok(!existsSync(ok))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
