import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  QUOTA_COOLDOWN_MS,
  RATE_COOLDOWN_MS,
  addKey,
  cleanLabel,
  emptyRing,
  pickKey,
  removeKey,
  reportLimit,
  toInfo,
  type ApiKeysOverview,
  type KeyRing
} from '../../shared/api-keys.ts'
import { SECRET_KEYS, isSecretKey, type SecretKey, type SecretStatus } from '../../shared/settings.ts'
import type { SecretStore } from './secret-store.ts'

export interface ApiKeys {
  overview(): ApiKeysOverview
  status(): SecretStatus
  add(provider: SecretKey, label: unknown, value: string): void
  remove(provider: SecretKey, id: string): void
  select(provider: SecretKey, id: string): void
  rename(provider: SecretKey, id: string, label: unknown): void
  setAuto(provider: SecretKey, auto: boolean): void
  /** Hapus tanda "kena batas" dari satu key. */
  resetLimit(provider: SecretKey, id: string): void
  /** Nilai key yang dipakai sekarang. Hanya untuk main process. */
  current(provider: SecretKey): string | undefined
  /** Dipanggil saat key yang sedang dipakai kena batas. True bila ada key lain yang kini dipakai. */
  reportLimit(provider: SecretKey, kind: 'quota' | 'rate'): boolean
}

const cipherName = (provider: SecretKey, id: string): string => `${provider}:${id}`

/**
 * Daftar key per penyedia. Nilai key terenkripsi di `secrets` (nama `penyedia:id`); nama, empat karakter terakhir,
 * pilihan aktif, dan tanda batas ada di `metaFile` tanpa nilai key.
 * Key tunggal dari versi lama (nama `penyedia`) dipindah jadi "Key 1" saat pertama dibuka.
 */
export function createApiKeys(opts: { metaFile: string; secrets: SecretStore; now?: () => number; newId?: () => string }): ApiKeys {
  const now = opts.now ?? Date.now
  const newId = opts.newId ?? ((): string => randomBytes(4).toString('hex'))
  const secrets = opts.secrets

  let rings: Partial<Record<SecretKey, KeyRing>> = {}
  if (existsSync(opts.metaFile)) {
    try {
      const raw = JSON.parse(readFileSync(opts.metaFile, 'utf8')) as Record<string, KeyRing>
      for (const [k, v] of Object.entries(raw)) if (isSecretKey(k) && Array.isArray(v?.keys)) rings[k] = v
    } catch {
      rings = {}
    }
  }

  const save = (): void => {
    mkdirSync(dirname(opts.metaFile), { recursive: true })
    const tmp = `${opts.metaFile}.tmp`
    writeFileSync(tmp, JSON.stringify(rings))
    renameSync(tmp, opts.metaFile)
  }
  const ring = (p: SecretKey): KeyRing => rings[p] ?? emptyRing()
  const put = (p: SecretKey, r: KeyRing): void => {
    rings[p] = r
    save()
  }

  let migrated = false
  for (const p of SECRET_KEYS) {
    const legacy = secrets.get(p)
    if (legacy === undefined) continue
    if (ring(p).keys.length === 0) {
      const id = newId()
      secrets.set(cipherName(p, id), legacy)
      rings[p] = addKey(emptyRing(), { id, label: 'Key 1', last4: legacy.slice(-4), addedAt: new Date(now()).toISOString(), limitedUntil: null })
    }
    secrets.clear(p)
    migrated = true
  }
  if (migrated) save()

  const mustHave = (p: SecretKey, id: string): void => {
    if (!ring(p).keys.some((k) => k.id === id)) throw new Error('Key tidak ditemukan.')
  }

  return {
    overview() {
      const t = now()
      return Object.fromEntries(SECRET_KEYS.map((p) => [p, toInfo(ring(p), t)])) as ApiKeysOverview
    },

    status: () => Object.fromEntries(SECRET_KEYS.map((p) => [p, ring(p).keys.length > 0])) as SecretStatus,

    add(provider, label, value) {
      const r = ring(provider)
      const id = newId()
      const next = addKey(r, { id, label: cleanLabel(label, `Key ${r.keys.length + 1}`), last4: value.slice(-4), addedAt: new Date(now()).toISOString(), limitedUntil: null })
      secrets.set(cipherName(provider, id), value)
      put(provider, next)
    },

    remove(provider, id) {
      mustHave(provider, id)
      secrets.clear(cipherName(provider, id))
      put(provider, removeKey(ring(provider), id))
    },

    select(provider, id) {
      mustHave(provider, id)
      put(provider, { ...ring(provider), activeId: id })
    },

    rename(provider, id, label) {
      mustHave(provider, id)
      const r = ring(provider)
      put(provider, { ...r, keys: r.keys.map((k) => (k.id === id ? { ...k, label: cleanLabel(label, k.label) } : k)) })
    },

    setAuto(provider, auto) {
      put(provider, { ...ring(provider), auto })
    },

    resetLimit(provider, id) {
      mustHave(provider, id)
      const r = ring(provider)
      put(provider, { ...r, keys: r.keys.map((k) => (k.id === id ? { ...k, limitedUntil: null } : k)) })
    },

    current(provider) {
      const k = pickKey(ring(provider), now())
      return k ? secrets.get(cipherName(provider, k.id)) : undefined
    },

    reportLimit(provider, kind) {
      const r = ring(provider)
      const k = pickKey(r, now())
      if (!k) return false
      const out = reportLimit(r, k.id, now(), kind === 'rate' ? RATE_COOLDOWN_MS : QUOTA_COOLDOWN_MS)
      put(provider, out.ring)
      return out.next !== null
    }
  }
}
