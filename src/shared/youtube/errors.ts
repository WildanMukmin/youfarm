/**
 * Klasifikasi error YouTube supaya antrean tahu harus apa:
 * - retry: gangguan sementara, coba lagi nanti
 * - quota: batas harian Google tercapai (project atau channel), tunggu sampai reset
 * - account: token atau izin bermasalah, butuh tindakan pengguna di menu Akun
 * - item: video ini bermasalah (judul, berkas, dll.), lewati dan tampilkan di "Perlu perhatian"
 */
export type ErrorKind = 'retry' | 'quota' | 'account' | 'item'

export interface ClassifiedError {
  kind: ErrorKind
  message: string
  /** Untuk kind 'quota': berlaku untuk satu channel saja atau seluruh project. */
  scope?: 'channel' | 'project'
}

const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded'])
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded'])
const UPLOAD_LIMIT_REASONS = new Set(['uploadLimitExceeded'])
const ACCOUNT_REASONS = new Set([
  'authError',
  'forbidden',
  'insufficientPermissions',
  'youtubeSignupRequired',
  'accessNotConfigured',
  'unauthorized'
])
const ITEM_REASONS = new Set([
  'invalidTitle',
  'invalidDescription',
  'invalidTags',
  'invalidCategoryId',
  'invalidPublishAt',
  'mediaBodyRequired',
  'invalidVideoMetadata',
  'unsupportedFormat',
  'videoTooLong',
  'invalidImage',
  'thumbnailTooLarge',
  'forbiddenPrivacySetting'
])

export function classifyYoutubeError(e: { status?: number; reason?: string; network?: boolean }): ClassifiedError {
  const { status = 0, reason = '' } = e

  if (e.network) return { kind: 'retry', message: 'Koneksi terputus. Akan dicoba lagi.' }
  if (UPLOAD_LIMIT_REASONS.has(reason)) {
    return { kind: 'quota', scope: 'channel', message: 'Batas upload harian channel ini dari YouTube tercapai. Lanjut otomatis setelah reset.' }
  }
  if (QUOTA_REASONS.has(reason)) {
    return { kind: 'quota', scope: 'project', message: 'Batas harian Google untuk project ini tercapai. Lanjut otomatis setelah reset.' }
  }
  if (RATE_REASONS.has(reason)) {
    return { kind: 'retry', message: 'Terlalu banyak permintaan dalam waktu singkat. Akan dicoba lagi.' }
  }
  if (status === 401 || reason === 'invalid_grant') {
    return { kind: 'account', message: 'Akses akun YouTube tidak berlaku. Hubungkan ulang di menu Akun.' }
  }
  if (ACCOUNT_REASONS.has(reason)) {
    return { kind: 'account', message: 'Akun ini belum punya izin yang dibutuhkan. Hubungkan ulang di menu Akun.' }
  }
  if (ITEM_REASONS.has(reason) || status === 400 || status === 413 || status === 415) {
    return { kind: 'item', message: 'YouTube menolak video ini. Periksa judul, deskripsi, dan berkasnya.' }
  }
  if (status === 429 || status >= 500 || status === 408 || status === 404) {
    return { kind: 'retry', message: 'YouTube sedang bermasalah. Akan dicoba lagi.' }
  }
  if (status === 403) return { kind: 'account', message: 'Akses ditolak YouTube. Periksa izin akun di menu Akun.' }
  return { kind: 'item', message: `Upload gagal (HTTP ${status || 'tidak diketahui'}).` }
}

/** Ambil `reason` dari body error Google Data API. */
export function reasonFromBody(body: unknown): string {
  const err = (body as { error?: { errors?: { reason?: string }[]; status?: string } | string })?.error
  if (typeof err === 'string') return err
  return err?.errors?.[0]?.reason ?? ''
}
