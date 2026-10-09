/**
 * Daftar API key per penyedia dan aturan memilih key. Murni: tanpa Electron, Node API, atau nilai key itu sendiri
 * (nilai key hanya ada di main process, terenkripsi).
 */
import { SECRET_KEYS, type SecretKey } from './settings.ts'

export const MAX_KEYS_PER_PROVIDER = 10
export const MAX_LABEL = 40

/** Key yang kena batas per menit dicoba lagi setelah ini. */
export const RATE_COOLDOWN_MS = 2 * 60 * 1000
/** Key yang kuotanya habis dicoba lagi setelah ini. */
export const QUOTA_COOLDOWN_MS = 60 * 60 * 1000

export interface StoredKey {
  id: string
  label: string
  /** Empat karakter terakhir, untuk mengenali key di tabel. */
  last4: string
  addedAt: string
  /** Sampai kapan key dianggap kena batas (ISO), atau null. */
  limitedUntil: string | null
}

export interface KeyRing {
  /** Key yang dipilih pengguna (atau yang dipindah otomatis). */
  activeId: string | null
  /** Pindah ke key berikutnya bila key aktif kena batas. */
  auto: boolean
  keys: StoredKey[]
}

export interface ApiKeyInfo extends StoredKey {
  active: boolean
  limited: boolean
}

export interface ProviderKeys {
  auto: boolean
  keys: ApiKeyInfo[]
}

export type ApiKeysOverview = Record<SecretKey, ProviderKeys>

export const emptyRing = (): KeyRing => ({ activeId: null, auto: true, keys: [] })

export const isLimited = (k: StoredKey, now: number): boolean => k.limitedUntil !== null && Date.parse(k.limitedUntil) > now

/** Nama key yang rapi; kosong memakai `fallback`. */
export function cleanLabel(raw: unknown, fallback: string): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) : ''
  return t || fallback
}

export function addKey(ring: KeyRing, key: StoredKey): KeyRing {
  if (ring.keys.length >= MAX_KEYS_PER_PROVIDER) throw new Error(`Maksimal ${MAX_KEYS_PER_PROVIDER} key per penyedia.`)
  return { ...ring, keys: [...ring.keys, key], activeId: ring.activeId ?? key.id }
}

export function removeKey(ring: KeyRing, id: string): KeyRing {
  const keys = ring.keys.filter((k) => k.id !== id)
  return { ...ring, keys, activeId: ring.activeId === id ? (keys[0]?.id ?? null) : ring.activeId }
}

/** Key yang dipakai sekarang: yang terpilih, atau key pertama bila pilihan hilang. */
export function selectedKey(ring: KeyRing): StoredKey | null {
  return ring.keys.find((k) => k.id === ring.activeId) ?? ring.keys[0] ?? null
}

/** Key berikutnya (berurutan, melingkar) yang belum kena batas, selain `fromId`. */
export function nextUsable(ring: KeyRing, fromId: string, now: number): StoredKey | null {
  const i = ring.keys.findIndex((k) => k.id === fromId)
  for (let step = 1; step < ring.keys.length; step++) {
    const k = ring.keys[(i + step) % ring.keys.length]
    if (!isLimited(k, now)) return k
  }
  return null
}

/**
 * Key untuk permintaan berikutnya. Key terpilih yang sedang kena batas diganti otomatis bila `auto` menyala;
 * bila semua kena batas atau `auto` mati, key terpilih tetap dipakai (batasnya mungkin sudah pulih).
 */
export function pickKey(ring: KeyRing, now: number): StoredKey | null {
  const sel = selectedKey(ring)
  if (!sel || !ring.auto || !isLimited(sel, now)) return sel
  return nextUsable(ring, sel.id, now) ?? sel
}

/** Tandai key kena batas. Dengan `auto` menyala, key berikutnya yang siap jadi aktif dan dikembalikan sebagai `next`. */
export function reportLimit(ring: KeyRing, id: string, now: number, cooldownMs: number): { ring: KeyRing; next: StoredKey | null } {
  const until = new Date(now + cooldownMs).toISOString()
  const marked: KeyRing = { ...ring, keys: ring.keys.map((k) => (k.id === id ? { ...k, limitedUntil: until } : k)) }
  if (!ring.auto) return { ring: marked, next: null }
  const next = nextUsable(marked, id, now)
  return next ? { ring: { ...marked, activeId: next.id }, next } : { ring: marked, next: null }
}

export function toInfo(ring: KeyRing, now: number): ProviderKeys {
  const sel = selectedKey(ring)
  return { auto: ring.auto, keys: ring.keys.map((k) => ({ ...k, active: k.id === sel?.id, limited: isLimited(k, now) })) }
}

export const emptyOverview = (): ApiKeysOverview => Object.fromEntries(SECRET_KEYS.map((p) => [p, { auto: true, keys: [] }])) as unknown as ApiKeysOverview
