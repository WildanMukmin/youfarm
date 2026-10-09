/** Kuota harian YouTube Data API (10.000 unit, direset tengah malam waktu Pasifik). Murni. */

export const DAILY_QUOTA = 10_000

export const QUOTA_COST = {
  videoUpload: 1600,
  thumbnailSet: 50,
  videoUpdate: 50,
  captionInsert: 400,
  playlistItemInsert: 50,
  channelsList: 1
} as const

export interface QuotaState {
  /** Hari kuota (tanggal di zona Pasifik) saat `used` dihitung. */
  day: string
  used: number
}

/** Tanggal (YYYY-MM-DD) di America/Los_Angeles; hari kuota YouTube berganti di sana. */
export function quotaDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** State untuk hari ini; pemakaian hari lain dianggap sudah direset. */
export function currentQuota(state: QuotaState | null, now: Date): QuotaState {
  const day = quotaDay(now)
  return state && state.day === day ? state : { day, used: 0 }
}

export const remainingQuota = (s: QuotaState): number => Math.max(0, DAILY_QUOTA - s.used)

export const canSpend = (s: QuotaState, cost: number): boolean => s.used + cost <= DAILY_QUOTA

export function spend(s: QuotaState, cost: number): QuotaState {
  return { ...s, used: s.used + cost }
}

/** Sisa upload hari ini bila tiap upload memakai `perUpload` unit (default: upload saja). */
export function uploadsLeft(s: QuotaState, perUpload: number = QUOTA_COST.videoUpload): number {
  return Math.floor(remainingQuota(s) / perUpload)
}

/** Kapan kuota berikutnya direset (tengah malam Pasifik), untuk pesan "lanjut besok". */
export function nextQuotaReset(now: Date): Date {
  const day = quotaDay(now)
  // Cari menit pertama yang hari kuotanya berbeda, maju per 15 menit dari sekarang (maks ~25 jam).
  let t = now.getTime()
  for (let i = 0; i < 100; i++) {
    t += 15 * 60_000
    if (quotaDay(new Date(t)) !== day) break
  }
  // Persempit ke menit.
  let lo = t - 15 * 60_000
  while (lo < t) {
    lo += 60_000
    if (quotaDay(new Date(lo)) !== day) return new Date(lo)
  }
  return new Date(t)
}
