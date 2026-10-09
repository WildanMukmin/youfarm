import type { Sqlite } from '../platform/sqlite.ts'
import type { RenderedVideo } from '../../shared/contracts/modes.ts'
import {
  MAX_BATCH,
  type ProductionDetail,
  type ProductionEnqueueRequest,
  type ProductionJob,
  type ProductionSnapshot,
  type ProductionStatus,
  type PublishPlan
} from '../../shared/production.ts'

export interface ProductionResult {
  video: RenderedVideo
  description: string
  tags: string[]
  /** Kalimat naskah, untuk panel Naskah. */
  sentences: string[]
  warnings: string[]
}

export interface Progress {
  stage: string
  percent: number
  message: string
}

/** Menjalankan satu video untuk satu mode. Mode tidak saling mengenal; antrean hanya memanggil runner. */
export type Runner = (options: unknown, onProgress: (p: Progress) => void, signal: AbortSignal) => Promise<ProductionResult>

export interface ProductionDeps {
  db: Sqlite
  runners: Partial<Record<string, Runner>>
  /** Validasi opsi saat masuk antrean; melempar pesan jelas bila tidak valid. Mengembalikan opsi yang sudah dirapikan. */
  validate: (mode: string, options: unknown) => { options: unknown; topic: string }
  /** Video jadi dan punya rencana publikasi: masukkan ke antrean upload, kembalikan id item upload. */
  publish?: (result: ProductionResult, plan: PublishPlan) => number
  now?: () => Date
}

interface Row {
  id: number
  mode: string
  topic: string
  options_json: string
  publish_json: string | null
  status: ProductionStatus
  attempts: number
  error_message: string | null
  warning: string | null
  title: string | null
  result_json: string | null
  upload_id: number | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

export type ProductionOutcome = 'idle' | 'done' | 'failed' | 'cancelled'

export function createProductionQueue(deps: ProductionDeps) {
  const { db } = deps
  const now = deps.now ?? (() => new Date())
  const iso = (): string => now().toISOString()
  // Progres disimpan di memori, bukan di database: diperbarui puluhan kali per video.
  const live = new Map<number, Progress>()
  let current: { id: number; ac: AbortController } | null = null
  // Job yang dihentikan karena antrean dijeda (bukan dibatalkan pengguna) kembali antre.
  const requeueOnAbort = new Set<number>()
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const toJob = (r: Row): ProductionJob => {
    const p = live.get(r.id)
    const result = r.result_json ? (JSON.parse(r.result_json) as ProductionResult) : null
    return {
      id: r.id,
      mode: r.mode as ProductionJob['mode'],
      topic: r.topic,
      status: r.status,
      stage: r.status === 'running' ? (p?.stage ?? null) : null,
      percent: r.status === 'done' ? 100 : r.status === 'running' ? (p?.percent ?? 0) : 0,
      message: r.status === 'running' ? (p?.message ?? 'Menyiapkan…') : null,
      errorMessage: r.error_message,
      warning: r.warning,
      title: r.title,
      durationSec: result?.video.durationSec ?? null,
      publish: r.publish_json ? (JSON.parse(r.publish_json) as PublishPlan) : null,
      uploadId: r.upload_id,
      attempts: r.attempts,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      finishedAt: r.finished_at
    }
  }

  const get = (id: number): Row | undefined => db.get<Row>('SELECT * FROM production_jobs WHERE id = ?', [id])

  function enqueue(req: ProductionEnqueueRequest): number[] {
    if (!deps.runners[req.mode]) throw new Error('Mode ini belum bisa diantrekan.')
    if (!Array.isArray(req.options) || req.options.length === 0) throw new Error('Tidak ada video untuk diantrekan.')
    if (req.options.length > MAX_BATCH) throw new Error(`Maksimal ${MAX_BATCH} video sekali antre.`)
    // Validasi semua dulu: satu opsi rusak membatalkan seluruh batch, bukan sebagian masuk.
    const checked = req.options.map((o) => deps.validate(req.mode, o))
    const at = iso()
    const ids: number[] = []
    for (const c of checked) {
      db.run(
        `INSERT INTO production_jobs (mode, topic, options_json, publish_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
        [req.mode, c.topic, JSON.stringify(c.options), req.publish ? JSON.stringify(req.publish) : null, at, at]
      )
      ids.push(db.get<{ id: number }>('SELECT last_insert_rowid() AS id')!.id)
    }
    return ids
  }

  const snapshot = (): ProductionSnapshot => ({
    items: db.all<Row>('SELECT * FROM production_jobs ORDER BY id DESC').map(toJob),
    running
  })

  /** Job yang terputus karena aplikasi ditutup kembali ke antrean. */
  function recoverInterrupted(): number {
    const n = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM production_jobs WHERE status = 'running'")!.n
    if (n) db.run("UPDATE production_jobs SET status = 'queued', updated_at = ? WHERE status = 'running'", [iso()])
    return n
  }

  function cancel(id: number): void {
    if (current?.id === id) current.ac.abort()
    else db.run("UPDATE production_jobs SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'queued'", [iso(), id])
  }

  function retry(id: number): void {
    db.run(
      "UPDATE production_jobs SET status = 'queued', error_message = NULL, warning = NULL, updated_at = ? WHERE id = ? AND status IN ('failed', 'cancelled')",
      [iso(), id]
    )
  }

  function remove(id: number): void {
    db.run("DELETE FROM production_jobs WHERE id = ? AND status != 'running'", [id])
  }

  /** Hasil job yang sudah jadi (untuk membuka berkas atau pratinjau). */
  function result(id: number): ProductionResult | null {
    const r = get(id)
    return r?.result_json ? (JSON.parse(r.result_json) as ProductionResult) : null
  }

  /** Hasil untuk renderer: tanpa path berkas. Video lama belum punya `sentences`. */
  function detail(id: number): ProductionDetail | null {
    const r = get(id)
    const res = r?.result_json ? (JSON.parse(r.result_json) as ProductionResult) : null
    if (!r || !res) return null
    const { filePath: _f, thumbnailPath, captionPath: _c, ...video } = res.video
    return {
      id,
      video: { ...video, hasThumbnail: Boolean(thumbnailPath) },
      description: res.description,
      tags: res.tags,
      sentences: res.sentences ?? [],
      // Kolom warning = peringatan video + (bila ada) kegagalan memasukkan ke antrean upload, digabung spasi.
      warnings: [...res.warnings, (r.warning ?? '').slice(res.warnings.join(' ').length).trim()].filter(Boolean),
      uploadId: r.upload_id
    }
  }

  /** Catat bahwa video ini sudah dimasukkan ke antrean upload (dari panel Publikasi). */
  function attachUpload(id: number, uploadId: number): void {
    db.run("UPDATE production_jobs SET upload_id = ?, updated_at = ? WHERE id = ? AND status = 'done'", [uploadId, iso(), id])
  }

  async function processNext(): Promise<ProductionOutcome> {
    const row = db.get<Row>("SELECT * FROM production_jobs WHERE status = 'queued' ORDER BY id LIMIT 1")
    if (!row) return 'idle'
    const runner = deps.runners[row.mode]
    db.run("UPDATE production_jobs SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ?, error_message = NULL WHERE id = ?", [iso(), iso(), row.id])
    const ac = new AbortController()
    current = { id: row.id, ac }
    live.set(row.id, { stage: 'script', percent: 0, message: 'Menyiapkan…' })

    try {
      if (!runner) throw new Error('Mode ini tidak tersedia lagi.')
      const res = await runner(JSON.parse(row.options_json), (p) => live.set(row.id, p), ac.signal)

      let uploadId: number | null = null
      const warnings = [...res.warnings]
      const plan = row.publish_json ? (JSON.parse(row.publish_json) as PublishPlan) : null
      if (plan && deps.publish) {
        try {
          uploadId = deps.publish(res, plan)
        } catch (e) {
          warnings.push(`Video jadi, tetapi belum masuk antrean upload: ${e instanceof Error ? e.message : 'gagal'}`)
        }
      }
      db.run(
        "UPDATE production_jobs SET status = 'done', title = ?, result_json = ?, upload_id = ?, warning = ?, finished_at = ?, updated_at = ? WHERE id = ?",
        [res.video.title, JSON.stringify(res), uploadId, warnings.length ? warnings.join(' ') : null, iso(), iso(), row.id]
      )
      return 'done'
    } catch (e) {
      if (ac.signal.aborted) {
        const back = requeueOnAbort.delete(row.id)
        db.run('UPDATE production_jobs SET status = ?, updated_at = ? WHERE id = ?', [back ? 'queued' : 'cancelled', iso(), row.id])
        return back ? 'idle' : 'cancelled'
      }
      db.run("UPDATE production_jobs SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?", [
        e instanceof Error ? e.message : 'Gagal membuat video.',
        iso(),
        iso(),
        row.id
      ])
      return 'failed'
    } finally {
      live.delete(row.id)
      current = null
    }
  }

  function start(opts: { gapMs?: number; idleMs?: number } = {}): void {
    if (running) return
    running = true
    recoverInterrupted()
    const { gapMs = 1500, idleMs = 3000 } = opts
    const loop = async (): Promise<void> => {
      if (!running) return
      let wait = idleMs
      try {
        const o = await processNext()
        if (o !== 'idle') wait = gapMs
      } catch {
        wait = 10_000
      }
      if (running) timer = setTimeout(() => void loop(), wait)
    }
    void loop()
  }

  /** Berhenti mengambil job baru. Job yang sedang berjalan dibatalkan dan kembali antre. */
  function stop(): void {
    running = false
    if (timer) clearTimeout(timer)
    timer = null
    if (current) {
      requeueOnAbort.add(current.id)
      current.ac.abort()
    }
  }

  /** Judul video yang sudah jadi untuk satu mode, terbaru dulu (bahan daftar "avoid" supaya fakta tidak berulang). */
  function recentTitles(mode: string, limit = 30): string[] {
    return db
      .all<{ title: string }>("SELECT title FROM production_jobs WHERE mode = ? AND status = 'done' AND title IS NOT NULL ORDER BY id DESC LIMIT ?", [mode, limit])
      .map((r) => r.title)
  }

  return { enqueue, snapshot, cancel, retry, remove, result, detail, attachUpload, processNext, recoverInterrupted, start, stop, recentTitles, isRunning: () => running }
}

export type ProductionQueue = ReturnType<typeof createProductionQueue>
