/** Jadwal tayang: slot jam per channel dan pengisian slot kosong berikutnya. Murni, waktu disuntikkan. */

import { MIN_PUBLISH_LEAD_MIN } from './metadata.ts'

const MINUTE = 60_000
const DAY = 86_400_000

export function isValidSlotTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

/** Urutkan dan buang duplikat serta format tak valid. */
export function normalizeSlots(times: string[]): string[] {
  return [...new Set(times.filter(isValidSlotTime))].sort()
}

/**
 * `tzOffsetMin` seperti `Date.getTimezoneOffset()` (menit; WIB = -420). Slot "07:00" WIB
 * berarti 00:00 UTC. Offset diberikan eksplisit supaya hasilnya tidak bergantung zona waktu mesin.
 */
function slotInstant(dayStartUtcMs: number, time: string, tzOffsetMin: number): number {
  const [h, m] = time.split(':').map(Number)
  return dayStartUtcMs + (h * 60 + m + tzOffsetMin) * MINUTE
}

/**
 * Isi `count` slot kosong berikutnya: tidak di masa lalu, minimal MIN_PUBLISH_LEAD_MIN dari sekarang,
 * dan tidak bentrok (menit yang sama) dengan jadwal yang sudah terisi.
 */
export function nextFreeSlots(p: {
  times: string[]
  occupied: string[]
  now: Date
  count: number
  tzOffsetMin: number
  /** Batas pencarian ke depan, supaya tidak berputar selamanya. */
  maxDays?: number
}): string[] {
  const times = normalizeSlots(p.times)
  if (times.length === 0 || p.count <= 0) return []
  const taken = new Set(p.occupied.map((o) => Math.floor(new Date(o).getTime() / MINUTE)))
  const earliest = p.now.getTime() + MIN_PUBLISH_LEAD_MIN * MINUTE

  // Hari lokal pengguna dihitung di ruang "waktu lokal": geser now sesuai offset lalu potong ke tengah malam.
  const localNow = p.now.getTime() - p.tzOffsetMin * MINUTE
  const localMidnight = Math.floor(localNow / DAY) * DAY
  const dayStartUtc = localMidnight // tengah malam lokal, ditulis dalam jam dinding (slotInstant menambahkan offset)

  const out: string[] = []
  const maxDays = p.maxDays ?? 365
  for (let d = 0; d < maxDays && out.length < p.count; d++) {
    for (const t of times) {
      const at = slotInstant(dayStartUtc + d * DAY, t, p.tzOffsetMin)
      if (at < earliest) continue
      const key = Math.floor(at / MINUTE)
      if (taken.has(key)) continue
      taken.add(key)
      out.push(new Date(at).toISOString())
      if (out.length >= p.count) break
    }
  }
  return out
}

/** Jeda acak antar upload supaya pola unggahan tidak seragam. `rand` di [0,1). */
export function randomGapMs(rand: number, minSec: number, maxSec: number): number {
  const lo = Math.min(minSec, maxSec)
  const hi = Math.max(minSec, maxSec)
  return Math.round((lo + rand * (hi - lo)) * 1000)
}
