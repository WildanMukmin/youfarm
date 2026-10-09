import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { MIN_LOCAL_CANDIDATES, mergePhrases, pickAmongTop, rankLocal, RECENT_WINDOW, type LocalClip } from '../../shared/footage.ts'
import type { StockVideo } from './ai/stock.ts'
import type { Sqlite } from './sqlite.ts'

export interface FootageStats {
  count: number
  bytes: number
}

export interface FootageLibrary {
  /** Folder unduhan untuk satu penyedia. */
  dirFor(provider: string): string
  /** Mulai video baru; nomornya dipakai untuk menghindari klip yang baru dipakai. */
  beginVideo(): number
  /** Klip dari pustaka untuk satu kalimat, atau null bila kandidat cocok terlalu sedikit (kecuali `relaxed`). */
  pick(provider: string, queries: string[], p: { neededSec: number; used: Set<number>; seq: number; rng: () => number; relaxed?: boolean }): LocalClip | null
  /** Klip yang baru dipakai (dalam jendela video terakhir), untuk dihindari saat memilih dari hasil API. */
  recentIds(provider: string, seq: number): Set<number>
  /** Catat klip yang dipakai video ini (baru diunduh atau dari pustaka). */
  use(provider: string, video: Pick<StockVideo, 'id' | 'duration' | 'width' | 'height'>, path: string, phrase: string | null, seq: number): Promise<void>
  /** Hapus klip yang paling lama tidak dipakai sampai total di bawah batas. Klip di `keep` tidak disentuh. */
  prune(maxBytes: number, keep: Set<string>): Promise<number>
  stats(): FootageStats
  /** Hapus semua klip yang tercatat (berkas lain di folder tidak disentuh). */
  clear(): Promise<number>
  /** Pindahkan klip dari cache lama (`<penyedia>-<id>.mp4`) ke pustaka. Mengembalikan jumlah yang dipindah. */
  adoptLegacy(legacyDir: string): Promise<number>
}

interface Row {
  provider: string
  id: number
  path: string
  duration: number
  width: number
  height: number
  size: number
  phrases_json: string
  uses: number
  last_seq: number
}

const SEQ_KEY = 'footage-seq'
const toClip = (r: Row): LocalClip => ({ provider: r.provider, id: r.id, path: r.path, duration: r.duration, width: r.width, height: r.height, phrases: JSON.parse(r.phrases_json) as string[], uses: r.uses, lastSeq: r.last_seq })
export const clipKey = (provider: string, id: number): string => `${provider}:${id}`

export function createFootageLibrary(opts: { db: Sqlite; dirFor: (provider: string) => string; now?: () => Date }): FootageLibrary {
  const { db } = opts
  const iso = (): string => (opts.now ?? (() => new Date()))().toISOString()

  const forget = (provider: string, id: number): void => db.run('DELETE FROM footage WHERE provider = ? AND id = ?', [provider, id])

  return {
    dirFor: opts.dirFor,

    beginVideo() {
      const seq = Number(db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [SEQ_KEY])?.value ?? 0) + 1
      db.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [SEQ_KEY, String(seq)])
      return seq
    },

    pick(provider, queries, p) {
      const rows = db.all<Row>('SELECT * FROM footage WHERE provider = ?', [provider])
      // Klip yang berkasnya sudah dihapus pengguna dilupakan, bukan dipakai.
      const clips = rows.filter((r) => (existsSync(r.path) ? true : (forget(provider, r.id), false))).map(toClip)
      const ranked = rankLocal(clips, queries, { neededSec: p.neededSec, used: p.used, seq: p.seq, relaxed: p.relaxed })
      if (ranked.length < (p.relaxed ? 1 : MIN_LOCAL_CANDIDATES)) return null
      return pickAmongTop(ranked, p.rng)
    },

    recentIds(provider, seq) {
      const rows = db.all<{ id: number }>('SELECT id FROM footage WHERE provider = ? AND last_seq > 0 AND ? - last_seq < ?', [provider, seq, RECENT_WINDOW])
      return new Set(rows.map((r) => r.id))
    },

    async use(provider, video, path, phrase, seq) {
      const size = (await stat(path).catch(() => null))?.size ?? 0
      const old = db.get<Row>('SELECT * FROM footage WHERE provider = ? AND id = ?', [provider, video.id])
      const phrases = mergePhrases(old ? (JSON.parse(old.phrases_json) as string[]) : [], phrase ? [phrase] : [])
      const now = iso()
      if (old) {
        db.run('UPDATE footage SET path = ?, size = ?, phrases_json = ?, uses = uses + 1, last_seq = ?, last_used_at = ? WHERE provider = ? AND id = ?', [path, size, JSON.stringify(phrases), seq, now, provider, video.id])
      } else {
        db.run('INSERT INTO footage (provider, id, path, duration, width, height, size, phrases_json, uses, last_seq, added_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)', [
          provider, video.id, path, video.duration, video.width, video.height, size, JSON.stringify(phrases), seq, now, now
        ])
      }
    },

    async prune(maxBytes, keep) {
      let total = db.get<{ n: number }>('SELECT COALESCE(SUM(size), 0) AS n FROM footage')!.n
      if (total <= maxBytes) return 0
      const rows = db.all<Row>('SELECT * FROM footage ORDER BY last_used_at ASC, id ASC')
      let removed = 0
      for (const r of rows) {
        if (total <= maxBytes) break
        if (keep.has(clipKey(r.provider, r.id))) continue
        await rm(r.path, { force: true }).catch(() => undefined)
        forget(r.provider, r.id)
        total -= r.size
        removed++
      }
      return removed
    },

    stats() {
      const r = db.get<{ count: number; bytes: number }>('SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM footage')!
      return { count: r.count, bytes: r.bytes }
    },

    async clear() {
      const rows = db.all<Row>('SELECT * FROM footage')
      for (const r of rows) await rm(r.path, { force: true }).catch(() => undefined)
      db.run('DELETE FROM footage')
      return rows.length
    },

    async adoptLegacy(legacyDir) {
      let moved = 0
      for (const name of await readdir(legacyDir).catch(() => [] as string[])) {
        const m = name.match(/^(pixabay|pexels)-(\d+)\.mp4$/)
        if (!m) continue
        const [, provider, id] = m
        const from = join(legacyDir, name)
        const dir = opts.dirFor(provider)
        const to = join(dir, name)
        await mkdir(dir, { recursive: true })
        await rename(from, to).catch(() => undefined)
        if (!existsSync(to)) continue
        const size = (await stat(to)).size
        const now = iso()
        // Tanpa frasa: tidak dipakai untuk pencocokan, tetapi ikut dikelola batas ukuran.
        db.run('INSERT OR IGNORE INTO footage (provider, id, path, size, added_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)', [provider, Number(id), to, size, now, now])
        moved++
      }
      return moved
    }
  }
}
