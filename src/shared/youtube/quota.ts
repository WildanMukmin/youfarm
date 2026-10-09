/**
 * Hari kuota YouTube berganti pada tengah malam waktu Pasifik. YouFarm tidak menghitung kuota sendiri;
 * waktu reset ini hanya dipakai untuk menunggu bila Google menolak karena batas harian.
 */

/** Tanggal (YYYY-MM-DD) di America/Los_Angeles. */
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

/** Kapan batas harian Google direset (tengah malam Pasifik). */
export function nextQuotaReset(now: Date): Date {
  const day = quotaDay(now)
  // Maju per 15 menit sampai hari Pasifik berganti (maks ~25 jam), lalu persempit ke menit.
  let t = now.getTime()
  for (let i = 0; i < 100; i++) {
    t += 15 * 60_000
    if (quotaDay(new Date(t)) !== day) break
  }
  let lo = t - 15 * 60_000
  while (lo < t) {
    lo += 60_000
    if (quotaDay(new Date(lo)) !== day) return new Date(lo)
  }
  return new Date(t)
}
