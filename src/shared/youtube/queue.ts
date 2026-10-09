/** Tipe antrean upload yang dibagi antara main dan renderer. */
import type { ModeId } from '../contracts/modes.ts'
import type { ErrorKind } from './errors.ts'
import type { UploadInput } from './metadata.ts'

/**
 * - queued: menunggu giliran
 * - uploading: sedang diunggah
 * - done: selesai, video sudah di YouTube
 * - failed: gagal permanen (item bermasalah atau percobaan habis), tampil di "Perlu perhatian"
 * - blocked: akunnya bermasalah; lanjut setelah dihubungkan ulang
 */
export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'blocked'

export const MAX_ATTEMPTS = 5

export interface EnqueueRequest {
  channelId: string
  mode: Exclude<ModeId, 'bedah-konten'>
  template: string | null
  filePath: string
  thumbnailPath: string | null
  playlistId: string | null
  input: UploadInput
}

export interface QueueItem {
  id: number
  channelId: string
  mode: string
  template: string | null
  title: string
  status: UploadStatus
  publishAt: string | null
  attempts: number
  notBefore: string | null
  errorKind: ErrorKind | null
  errorMessage: string | null
  warning: string | null
  videoId: string | null
  createdAt: string
  updatedAt: string
}

export interface QuotaSnapshot {
  used: number
  remaining: number
  uploadsLeft: number
  /** Kapan kuota direset (ISO). */
  resetAt: string
}

export interface QueueSnapshot {
  items: QueueItem[]
  quota: QuotaSnapshot
  running: boolean
}

/** Item yang butuh tindakan pengguna. */
export const needsAttention = (i: Pick<QueueItem, 'status'>): boolean => i.status === 'failed' || i.status === 'blocked'
