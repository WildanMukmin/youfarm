import { app } from 'electron'
import { join } from 'node:path'
import type { StockSource } from '@shared/stock'
import { getSecret } from '../secrets'
import { getSettings } from '../settings'
import { createGeminiClient, type GeminiClient } from './gemini-client'
import { createGroqClient, type GroqClient } from './groq-client'
import { createPexelsClient } from './pexels-client'
import { createPixabayClient } from './pixabay-client'
import type { StockClient } from './stock'
import { createDeepgramTts, type DeepgramTts } from '../voice/deepgram'

let gemini: GeminiClient | null = null
let groq: GroqClient | null = null
let deepgram: DeepgramTts | null = null
const stock: Partial<Record<StockSource, StockClient>> = {}

/** Hanya di build pengembangan: arahkan ke server palsu untuk menguji alur tanpa key sungguhan. */
const devBase = (name: string): string | undefined => (app.isPackaged ? undefined : process.env[name])

/** Key dibaca tiap permintaan, jadi key yang baru diisi di Settings langsung dipakai tanpa restart. */
export function getGemini(): GeminiClient {
  if (!gemini) gemini = createGeminiClient({ apiKey: () => getSecret('gemini'), base: devBase('YOUFARM_FAKE_GEMINI') })
  return gemini
}

export function getStock(source: StockSource): StockClient {
  stock[source] ??=
    source === 'pixabay'
      ? createPixabayClient({
          apiKey: () => getSecret('pixabay'),
          base: devBase('YOUFARM_FAKE_PIXABAY'),
          searchCacheDir: join(app.getPath('userData'), 'cache', 'pixabay-search')
        })
      : createPexelsClient({ apiKey: () => getSecret('pexels'), base: devBase('YOUFARM_FAKE_PEXELS') })
  return stock[source]
}

export function getGroq(): GroqClient {
  if (!groq) groq = createGroqClient({ apiKey: () => getSecret('groq'), base: devBase('YOUFARM_FAKE_GROQ') })
  return groq
}

export type TextLlm = (p: { system: string; user: string; temperature?: number; signal?: AbortSignal }) => Promise<unknown>

/** Penulis teks sesuai pilihan Settings > API (provider dan modelnya). Dibaca saat dipanggil. */
export function getTextLlm(): TextLlm {
  return async (p) => {
    const s = getSettings()
    if (s.textProvider === 'groq') {
      if (!s.groqTextModel) throw new Error('Pilih model Groq untuk teks di Settings > API.')
      return getGroq().completeJson({ ...p, model: s.groqTextModel })
    }
    if (!s.geminiTextModel) throw new Error('Pilih model Gemini untuk teks di Settings > API.')
    return getGemini().completeJson({ ...p, model: s.geminiTextModel })
  }
}

export function getDeepgram(): DeepgramTts {
  if (!deepgram) deepgram = createDeepgramTts({ apiKey: () => getSecret('deepgram'), base: devBase('YOUFARM_FAKE_DEEPGRAM') })
  return deepgram
}
