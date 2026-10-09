import type { Sqlite } from '../platform/sqlite.ts'
import { nextQuotaReset } from '../../shared/youtube/quota.ts'
import { buildUploadBody, type UploadInput } from '../../shared/youtube/metadata.ts'
import { randomGapMs } from '../../shared/youtube/schedule.ts'
import {
  MAX_ATTEMPTS,
  type EnqueueRequest,
  type QueueItem,
  type QueueSnapshot,
  type UploadStatus
} from '../../shared/youtube/queue.ts'
import type { ErrorKind } from '../../shared/youtube/errors.ts'
import { YoutubeApiError, addToPlaylist, setThumbnail, uploadVideo, type UploadedVideo } from './upload.ts'

interface Row {
  id: number
  channel_id: string
  mode: string
  template: string | null
  file_path: string
  thumbnail_path: string | null
  playlist_id: string | null
  input_json: string
  status: UploadStatus
  attempts: number
  not_before: string | null
  error_kind: ErrorKind | null
  error_message: string | null
  warning: string | null
  video_id: string | null
  created_at: string
  updated_at: string
}

export type Outcome = 'idle' | 'done' | 'failed' | 'retry' | 'quota' | 'blocked'

export interface QueueDeps {
  db: Sqlite
  /** Access token baru untuk satu kanal (dari layanan akun). Melempar bila akun bermasalah. */
  accessToken: (channelId: string, signal?: AbortSignal) => Promise<string>
  apiBase: string
  now?: () => Date
  rand?: () => number
  /** Bisa diganti tes. */
  uploader?: typeof uploadVideo
  chunkSize?: number
  retryDelayMs?: number
  /** Jeda dasar sebelum percobaan ulang item yang gagal sementara. */
  backoffMs?: number
}

export function createUploadQueue(deps: QueueDeps) {
  const { db } = deps
  const now = deps.now ?? (() => new Date())
  const rand = deps.rand ?? Math.random
  const uploader = deps.uploader ?? uploadVideo
  const backoffMs = deps.backoffMs ?? 60_000
  let current: AbortController | null = null
  let loopTimer: NodeJS.Timeout | null = null
  let running = false

  const iso = (): string => now().toISOString()

  // --- baris <-> item -----------------------------------------------------
  function toItem(r: Row): QueueItem {
    const input = JSON.parse(r.input_json) as UploadInput
    return {
      id: r.id,
      channelId: r.channel_id,
      mode: r.mode,
      template: r.template,
      title: input.title,
      status: r.status,
      publishAt: input.publishAt ?? null,
      attempts: r.attempts,
      notBefore: r.not_before,
      errorKind: r.error_kind,
      errorMessage: r.error_message,
      warning: r.warning,
      videoId: r.video_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  }

  function setStatus(id: number, status: UploadStatus, extra: Partial<Pick<Row, 'error_kind' | 'error_message' | 'warning' | 'video_id' | 'not_before'>> = {}): void {
    const cols = ['status = ?', 'updated_at = ?']
    const vals: (string | number | null)[] = [status, iso()]
    for (const [k, v] of Object.entries(extra)) {
      cols.push(`${k} = ?`)
      vals.push(v as string | null)
    }
    db.run(`UPDATE uploads SET ${cols.join(', ')} WHERE id = ?`, [...vals, id])
  }

  const snapshot = (): QueueSnapshot => ({
    items: db.all<Row>('SELECT * FROM uploads ORDER BY id DESC').map(toItem),
    running
  })

  // --- API publik ---------------------------------------------------------
  function enqueue(req: EnqueueRequest): number {
    // Validasi sekarang supaya judul kosong atau jadwal terlalu dekat langsung ketahuan, bukan saat upload.
    buildUploadBody(req.input, now())
    const at = iso()
    db.run(
      `INSERT INTO uploads (channel_id, mode, template, file_path, thumbnail_path, playlist_id, input_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      [req.channelId, req.mode, req.template, req.filePath, req.thumbnailPath, req.playlistId, JSON.stringify(req.input), at, at]
    )
    return db.get<{ id: number }>('SELECT last_insert_rowid() AS id')!.id
  }

  /** Upload yang terputus (aplikasi ditutup di tengah jalan) kembali ke antrean. */
  function recoverInterrupted(): number {
    const n = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM uploads WHERE status = 'uploading'")!.n
    if (n > 0) db.run("UPDATE uploads SET status = 'queued', updated_at = ? WHERE status = 'uploading'", [iso()])
    return n
  }

  /** Coba lagi satu item yang gagal atau terblokir. */
  function retry(id: number): void {
    db.run("UPDATE uploads SET status = 'queued', attempts = 0, not_before = NULL, error_kind = NULL, error_message = NULL, updated_at = ? WHERE id = ? AND status IN ('failed', 'blocked')", [iso(), id])
  }

  /** Lepas blokir semua item satu kanal (setelah akun dihubungkan ulang). */
  function unblockChannel(channelId: string): void {
    db.run("UPDATE uploads SET status = 'queued', error_kind = NULL, error_message = NULL, updated_at = ? WHERE channel_id = ? AND status = 'blocked'", [iso(), channelId])
  }

  function remove(id: number): void {
    db.run("DELETE FROM uploads WHERE id = ? AND status != 'uploading'", [id])
  }

  // --- inti: proses satu item --------------------------------------------
  async function processNext(): Promise<Outcome> {
    const row = db.get<Row>("SELECT * FROM uploads WHERE status = 'queued' AND (not_before IS NULL OR not_before <= ?) ORDER BY id LIMIT 1", [iso()])
    if (!row) return 'idle'

    const input = JSON.parse(row.input_json) as UploadInput
    db.run("UPDATE uploads SET status = 'uploading', attempts = attempts + 1, updated_at = ? WHERE id = ?", [iso(), row.id])
    const attempts = row.attempts + 1
    const ac = new AbortController()
    current = ac

    const fail = (kind: ErrorKind, message: string, scope?: 'channel' | 'project'): Outcome => {
      if (kind === 'account') {
        setStatus(row.id, 'blocked', { error_kind: kind, error_message: message })
        // Item lain di kanal yang sama menunggu juga, supaya tidak ikut gagal satu per satu.
        db.run("UPDATE uploads SET status = 'blocked', error_kind = 'account', error_message = ?, updated_at = ? WHERE channel_id = ? AND status = 'queued'", [message, iso(), row.channel_id])
        return 'blocked'
      }
      if (kind === 'quota') {
        // Google menolak karena batas harian: tunggu sampai reset. Batas channel hanya menahan channel itu;
        // batas project menahan semua yang antre. Tidak ada hitungan kuota lokal.
        const until = nextQuotaReset(now()).toISOString()
        setStatus(row.id, 'queued', { error_kind: kind, error_message: message, not_before: until })
        const where = scope === 'channel' ? "status = 'queued' AND channel_id = ?" : "status = 'queued'"
        db.run(`UPDATE uploads SET not_before = ?, error_kind = 'quota', error_message = ?, updated_at = ? WHERE ${where} AND id != ?`, scope === 'channel' ? [until, message, iso(), row.channel_id, row.id] : [until, message, iso(), row.id])
        return 'quota'
      }
      if (kind === 'retry' && attempts < MAX_ATTEMPTS) {
        setStatus(row.id, 'queued', { error_kind: kind, error_message: message, not_before: new Date(now().getTime() + backoffMs * 2 ** (attempts - 1)).toISOString() })
        return 'retry'
      }
      setStatus(row.id, 'failed', { error_kind: kind, error_message: message })
      return 'failed'
    }

    try {
      let token: string
      try {
        token = await deps.accessToken(row.channel_id, ac.signal)
      } catch (e) {
        const dead = (e as { tokenDead?: boolean }).tokenDead
        return fail(dead ? 'account' : 'retry', e instanceof Error ? e.message : 'Gagal mengambil token.')
      }

      let video: UploadedVideo
      try {
        const body = buildUploadBody(input, now())
        video = await uploader({
          accessToken: token,
          filePath: row.file_path,
          body,
          apiBase: deps.apiBase,
          signal: ac.signal,
          chunkSize: deps.chunkSize,
          retryDelayMs: deps.retryDelayMs
        })
      } catch (e) {
        if (ac.signal.aborted) {
          setStatus(row.id, 'queued', { error_message: 'Dibatalkan, akan dilanjutkan.' })
          return 'idle'
        }
        if (e instanceof YoutubeApiError) {
          return fail(e.classified.kind, e.classified.message, e.classified.scope)
        }
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fail('item', 'Berkas video tidak ditemukan di disk.')
        return fail('item', e instanceof Error ? e.message : 'Upload gagal.')
      }

      // Langkah tambahan tidak menggagalkan upload yang sudah berhasil; kegagalannya jadi peringatan.
      const warnings: string[] = []
      if (row.thumbnail_path) {
        try {
          await setThumbnail({ accessToken: token, videoId: video.id, filePath: row.thumbnail_path, apiBase: deps.apiBase, signal: ac.signal })
        } catch (e) {
          warnings.push(`Thumbnail tidak terpasang: ${e instanceof Error ? e.message : 'gagal'}`)
        }
      }
      if (row.playlist_id) {
        try {
          await addToPlaylist({ accessToken: token, playlistId: row.playlist_id, videoId: video.id, apiBase: deps.apiBase, signal: ac.signal })
        } catch (e) {
          warnings.push(`Belum masuk playlist: ${e instanceof Error ? e.message : 'gagal'}`)
        }
      }
      setStatus(row.id, 'done', { video_id: video.id, error_kind: null, error_message: null, warning: warnings.length ? warnings.join(' ') : null })
      return 'done'
    } finally {
      current = null
    }
  }

  /** Batalkan upload yang sedang berjalan; itemnya kembali ke antrean. */
  function cancelCurrent(): void {
    current?.abort()
  }

  // --- loop latar ---------------------------------------------------------
  function start(opts: { minGapSec?: number; maxGapSec?: number; idleMs?: number } = {}): void {
    if (running) return
    running = true
    recoverInterrupted()
    const { minGapSec = 30, maxGapSec = 120, idleMs = 5000 } = opts
    const loop = async (): Promise<void> => {
      if (!running) return
      let wait = idleMs
      try {
        const o = await processNext()
        if (o === 'done' || o === 'failed') wait = randomGapMs(rand(), minGapSec, maxGapSec)
        else if (o === 'retry' || o === 'blocked') wait = 5000
        else if (o === 'quota') wait = 30_000
      } catch {
        wait = 30_000
      }
      if (running) loopTimer = setTimeout(() => void loop(), wait)
    }
    void loop()
  }

  function stop(): void {
    running = false
    if (loopTimer) clearTimeout(loopTimer)
    loopTimer = null
    cancelCurrent()
  }

  return { enqueue, snapshot, retry, unblockChannel, remove, processNext, recoverInterrupted, cancelCurrent, start, stop, isRunning: () => running }
}

export type UploadQueue = ReturnType<typeof createUploadQueue>
