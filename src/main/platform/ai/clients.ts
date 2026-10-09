import { app } from 'electron'
import { join } from 'node:path'
import type { StockSource } from '@shared/stock'
import type { SecretKey, TextProvider } from '@shared/settings'
import { getApiKeys, getSecret } from '../secrets'
import { createGeminiClient, type GeminiClient } from './gemini-client'
import { createGroqClient, type GroqClient } from './groq-client'
import { createPexelsClient } from './pexels-client'
import { createPixabayClient } from './pixabay-client'
import { withRotation } from './rotation'
import type { StockClient } from './stock'
import { createDeepgramTts, type DeepgramTts } from '../voice/deepgram'
import { createElevenLabsTts, type ElevenLabsTts } from '../voice/elevenlabs'

let elevenlabs: ElevenLabsTts | null = null
let gemini: GeminiClient | null = null
let groq: GroqClient | null = null
let deepgram: DeepgramTts | null = null
const stock: Partial<Record<StockSource, StockClient>> = {}

/** Hanya di build pengembangan: arahkan ke server palsu untuk menguji alur tanpa key sungguhan. */
const devBase = (name: string): string | undefined => (app.isPackaged ? undefined : process.env[name])

/** Bungkus klien penyedia agar pindah ke key lain bila key yang dipakai kena batas. */
const rotating = <T extends object>(provider: SecretKey, client: T): T => withRotation(client, (kind) => getApiKeys().reportLimit(provider, kind))

/** Key dibaca tiap permintaan, jadi key yang baru diisi atau dipilih di Settings langsung dipakai tanpa restart. */
export function getGemini(): GeminiClient {
  if (!gemini)
    gemini = rotating(
      'gemini',
      createGeminiClient({ apiKey: () => getSecret('gemini'), base: devBase('YOUFARM_FAKE_GEMINI'), onRateLimit: () => getApiKeys().reportLimit('gemini', 'rate') })
    )
  return gemini
}

export function getStock(source: StockSource): StockClient {
  stock[source] ??= rotating(
    source,
    source === 'pixabay'
      ? createPixabayClient({
          apiKey: () => getSecret('pixabay'),
          base: devBase('YOUFARM_FAKE_PIXABAY'),
          searchCacheDir: join(app.getPath('userData'), 'cache', 'pixabay-search')
        })
      : createPexelsClient({ apiKey: () => getSecret('pexels'), base: devBase('YOUFARM_FAKE_PEXELS') })
  )
  return stock[source]
}

export function getGroq(): GroqClient {
  if (!groq) groq = rotating('groq', createGroqClient({ apiKey: () => getSecret('groq'), base: devBase('YOUFARM_FAKE_GROQ') }))
  return groq
}

export type TextLlm = (p: { system: string; user: string; temperature?: number; signal?: AbortSignal }) => Promise<unknown>

/** Penulis teks sesuai pilihan di form mode (penyedia dan modelnya). */
export function getTextLlm(sel: { provider: TextProvider; model: string }): TextLlm {
  return async (p) => {
    const name = sel.provider === 'groq' ? 'Groq' : 'Gemini'
    if (!sel.model) throw new Error(`Pilih model ${name} untuk naskah di pengaturan mode.`)
    return sel.provider === 'groq' ? getGroq().completeJson({ ...p, model: sel.model }) : getGemini().completeJson({ ...p, model: sel.model })
  }
}

export function getDeepgram(): DeepgramTts {
  if (!deepgram) deepgram = rotating('deepgram', createDeepgramTts({ apiKey: () => getSecret('deepgram'), base: devBase('YOUFARM_FAKE_DEEPGRAM') }))
  return deepgram
}

export function getElevenLabs(): ElevenLabsTts {
  if (!elevenlabs) elevenlabs = rotating('elevenlabs', createElevenLabsTts({ apiKey: () => getSecret('elevenlabs'), base: devBase('YOUFARM_FAKE_ELEVENLABS') }))
  return elevenlabs
}
