import initSqlJs, { type Database } from 'sql.js'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)

export type SqlValue = string | number | null | Uint8Array

export interface Sqlite {
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[]
  get<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T | undefined
  run(sql: string, params?: SqlValue[]): void
  /** Tulis ke disk sekarang (biasanya otomatis, ditunda 300 ms). */
  flush(): void
  close(): void
}

/**
 * Buka database SQLite (sql.js) yang disimpan sebagai satu berkas.
 * `migrations[i]` dijalankan sekali, berurutan, dan versinya dicatat di PRAGMA user_version.
 */
export async function openSqlite(file: string, migrations: string[]): Promise<Sqlite> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  const db: Database = existsSync(file) ? new SQL.Database(readFileSync(file)) : new SQL.Database()

  const version = Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0] ?? 0)
  for (let i = version; i < migrations.length; i++) {
    db.run('BEGIN')
    try {
      db.run(migrations[i])
      db.run(`PRAGMA user_version = ${i + 1}`)
      db.run('COMMIT')
    } catch (err) {
      db.run('ROLLBACK')
      throw err
    }
  }

  let timer: NodeJS.Timeout | null = null
  let dirty = version < migrations.length

  const flush = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    if (!dirty) return
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, db.export())
    renameSync(tmp, file)
    dirty = false
  }
  const schedule = (): void => {
    dirty = true
    if (!timer) timer = setTimeout(flush, 300)
  }
  if (dirty) flush()

  const all = <T>(sql: string, params: SqlValue[] = []): T[] => {
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } finally {
      stmt.free()
    }
  }

  return {
    all,
    get: <T>(sql: string, params?: SqlValue[]) => all<T>(sql, params)[0],
    run(sql, params = []) {
      db.run(sql, params)
      schedule()
    },
    flush,
    close() {
      flush()
      db.close()
    }
  }
}
