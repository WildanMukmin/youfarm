import { DEFAULT_SETTINGS, mergeSettings, sanitizeProviders, type Settings } from '@shared/settings'
import { getKv, setKv } from './db'
import { secretStatus } from './secrets'

const KEY = 'settings'

export function getSettings(): Settings {
  const raw = getKv(KEY)
  let stored: unknown = null
  if (raw) {
    try {
      stored = JSON.parse(raw)
    } catch {
      stored = null
    }
  }
  return sanitizeProviders(mergeSettings(DEFAULT_SETTINGS, stored), secretStatus())
}

export function updateSettings(patch: unknown): Settings {
  const next = sanitizeProviders(mergeSettings(getSettings(), patch), secretStatus())
  setKv(KEY, JSON.stringify(next))
  return next
}
