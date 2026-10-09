import { app } from 'electron'
import { join } from 'node:path'
import { MIGRATIONS } from './migrations'
import { openSqlite, type Sqlite } from './sqlite'

let db: Sqlite | null = null

export async function initDb(): Promise<Sqlite> {
  db = await openSqlite(join(app.getPath('userData'), 'youfarm.db'), MIGRATIONS)
  app.on('before-quit', () => db?.flush())
  return db
}

export function getDb(): Sqlite {
  if (!db) throw new Error('Database belum dibuka. Panggil initDb() dulu.')
  return db
}

export function getKv(key: string): string | undefined {
  return getDb().get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])?.value
}

export function setKv(key: string, value: string): void {
  getDb().run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
}
