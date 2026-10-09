/**
 * Tipe dan logika murni untuk Settings umum. Tanpa Electron atau Node API.
 * Pengaturan teknis (rasio, bitrate, suara, transkripsi, gaya caption) bukan di sini:
 * itu opsi tiap mode.
 */

export const SECRET_KEYS = ['gemini', 'groq', 'deepgram', 'pixabay', 'pexels', 'elevenlabs'] as const
export type SecretKey = (typeof SECRET_KEYS)[number]
export type SecretStatus = Record<SecretKey, boolean>

export const THEMES = ['dark', 'light', 'system'] as const
/** Penyedia AI penulis naskah. Dipilih di tiap mode, bukan di Settings. */
export const TEXT_PROVIDERS = ['gemini', 'groq'] as const
export type TextProvider = (typeof TEXT_PROVIDERS)[number]

export interface Settings {
  theme: (typeof THEMES)[number]
  importDir: string | null
  outputDir: string | null
  /** Batas ukuran pustaka footage lokal, dalam GB. */
  footageCapGb: number
}

export const FOOTAGE_CAPS_GB = [2, 5, 10, 20, 50, 100] as const

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  importDir: null,
  outputDir: null,
  footageCapGb: 5
}

/** Provider -> key yang dibutuhkan. Provider lokal tidak butuh key. Dipakai juga oleh opsi tiap mode. */
const PROVIDER_KEY: Record<string, SecretKey | undefined> = {
  gemini: 'gemini',
  groq: 'groq',
  deepgram: 'deepgram',
  elevenlabs: 'elevenlabs',
  'gemini-tts': 'gemini',
  pixabay: 'pixabay',
  pexels: 'pexels',
  piper: undefined,
  'whisper-local': undefined
}

/** Provider cloud hanya bisa dipilih bila ada key-nya. */
export function isProviderAvailable(provider: string, status: SecretStatus): boolean {
  const key = PROVIDER_KEY[provider]
  return key === undefined ? true : status[key]
}

function oneOf<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

/** Gabungkan patch ke settings. Kunci tak dikenal dan nilai tak valid diabaikan. */
export function mergeSettings(base: Settings, patch: unknown): Settings {
  if (typeof patch !== 'object' || patch === null) return base
  const p = patch as Record<string, unknown>
  const next: Settings = { ...base }

  if (oneOf(THEMES, p.theme)) next.theme = p.theme

  for (const k of ['importDir', 'outputDir'] as const) {
    const v = p[k]
    if (v === null) next[k] = null
    else if (typeof v === 'string' && v.length > 0 && v.length <= 1024) next[k] = v
  }
  if (typeof p.footageCapGb === 'number' && Number.isInteger(p.footageCapGb) && p.footageCapGb >= 1 && p.footageCapGb <= 500) next.footageCapGb = p.footageCapGb
  return next
}

export function isSecretKey(v: unknown): v is SecretKey {
  return oneOf(SECRET_KEYS, v)
}

const NON_TEXT = /tts|image|embed|live|audio|veo|imagen|aqa|robotics/i

/** Pisahkan hasil daftar model API menjadi model teks dan model suara (TTS). */
export function splitGeminiModels(all: string[]): { text: string[]; tts: string[] } {
  return { text: all.filter((m) => !NON_TEXT.test(m)), tts: all.filter((m) => /tts/i.test(m)) }
}
