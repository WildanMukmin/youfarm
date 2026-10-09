import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '@shared/settings'
import { getKv, setKv } from './db'

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
  return mergeSettings(DEFAULT_SETTINGS, stored)
}

export function updateSettings(patch: unknown): Settings {
  const next = mergeSettings(getSettings(), patch)
  setKv(KEY, JSON.stringify(next))
  return next
}
