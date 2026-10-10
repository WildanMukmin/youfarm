/** Antrean produksi: membuat video di latar, satu per satu. Tipe dibagi antara main dan renderer. */
import type { AspectRatio, ProductionModeId, RenderedVideo } from './contracts/modes.ts'
import type { Privacy } from './youtube/metadata.ts'

/**
 * - queued: menunggu giliran
 * - running: sedang dibuat
 * - done: video jadi (dan, bila diminta, sudah masuk antrean upload)
 * - failed: gagal, bisa dicoba lagi
 * - cancelled: dibatalkan pengguna
 */
export type ProductionStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

/** Setelah video jadi: masukkan otomatis ke antrean upload. */
export interface PublishPlan {
  channelId: string
  privacy: Privacy
  /** True: tayang di jam tayang kosong berikutnya milik channel. */
  schedule: boolean
}

export interface ProductionJob {
  id: number
  mode: ProductionModeId
  topic: string
  status: ProductionStatus
  /** Progres langsung saat running. */
  stage: string | null
  percent: number
  message: string | null
  errorMessage: string | null
  warning: string | null
  /** Judul video setelah jadi. */
  title: string | null
  durationSec: number | null
  /** Format video yang diminta (dari opsi), atau hasil render bila sudah jadi. */
  aspect: AspectRatio
  publish: PublishPlan | null
  /** ID item antrean upload bila sudah dimasukkan otomatis. */
  uploadId: number | null
  attempts: number
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

/** Hasil lengkap satu video yang sudah jadi: untuk panel Naskah dan Publikasi. Path berkas tidak pernah dikirim ke renderer. */
export interface ProductionDetail {
  id: number
  video: Omit<RenderedVideo, 'filePath' | 'thumbnailPath' | 'captionPath'> & { hasThumbnail: boolean }
  description: string
  tags: string[]
  /** Kalimat naskah. Kosong untuk video yang dibuat sebelum naskah disimpan. */
  sentences: string[]
  warnings: string[]
  /** ID item antrean upload bila sudah dimasukkan. */
  uploadId: number | null
}

export interface ProductionPublishRequest {
  id: number
  channelId: string
  privacy: Privacy
  /** True: tayang di jam tayang kosong berikutnya milik channel. */
  schedule: boolean
  /** Hasil suntingan di panel Publikasi; kosong berarti memakai isi bawaan video. */
  title?: string
  description?: string
  tags?: string[]
  /** Pakai thumbnail yang baru dipilih lewat `pickThumbnail` (bukan yang dibuat otomatis). */
  customThumbnail?: boolean
}

export interface ProductionPublishResult {
  queueId: number
  publishAt: string | null
}

export interface ProductionSnapshot {
  items: ProductionJob[]
  running: boolean
}

export interface ProductionEnqueueRequest {
  mode: ProductionModeId
  /** Satu set opsi per video. */
  options: unknown[]
  publish: PublishPlan | null
}

export const MAX_BATCH = 50

/** "fakta laut\n\n  sejarah  piramida \nfakta laut" -> ["fakta laut", "sejarah piramida"]. */
export function splitTopics(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.replace(/\s+/g, ' ').trim()
    const key = t.toLowerCase()
    if (!t || seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
