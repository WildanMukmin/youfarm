import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openSqlite } from '../../src/main/platform/sqlite.ts'
import { createSecretStore } from '../../src/main/platform/secret-store.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'youfarm-test-'))

test('sqlite: migrasi jalan sekali dan data bertahan setelah dibuka ulang', async () => {
  const file = join(tmp(), 'a.db')
  const migrations = ['CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)']
  const db = await openSqlite(file, migrations)
  db.run('INSERT INTO t (v) VALUES (?)', ['halo'])
  db.close()

  const db2 = await openSqlite(file, [...migrations, 'ALTER TABLE t ADD COLUMN extra TEXT'])
  assert.equal(db2.get<{ v: string }>('SELECT v FROM t')?.v, 'halo')
  assert.equal(db2.all('PRAGMA table_info(t)').length, 3)
  db2.close()
})

test('sqlite: migrasi gagal di-rollback', async () => {
  const file = join(tmp(), 'b.db')
  await assert.rejects(openSqlite(file, ['CREATE TABLE ok (id INTEGER)', 'SELEKSI SALAH']))
})

test('secret-store: nilai tidak tersimpan sebagai teks biasa dan bisa dihapus', () => {
  const file = join(tmp(), 'secrets.json')
  const codec = {
    encrypt: (s: string) => Buffer.from(s.split('').reverse().join('')).toString('base64'),
    decrypt: (c: string) => Buffer.from(c, 'base64').toString().split('').reverse().join('')
  }
  const store = createSecretStore(file, codec)
  store.set('gemini', 'rahasia-123')
  assert.equal(store.has('gemini'), true)
  assert.equal(store.get('gemini'), 'rahasia-123')
  assert.ok(!readFileSync(file, 'utf8').includes('rahasia-123'))

  assert.equal(createSecretStore(file, codec).get('gemini'), 'rahasia-123')
  store.clear('gemini')
  assert.equal(store.has('gemini'), false)
  assert.equal(createSecretStore(file, codec).has('gemini'), false)
})
