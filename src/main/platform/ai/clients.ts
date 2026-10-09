import { app } from 'electron'
import { getSecret } from '../secrets'
import { createGeminiClient, type GeminiClient } from './gemini-client'
import { createPexelsClient, type PexelsClient } from './pexels-client'

let gemini: GeminiClient | null = null
let pexels: PexelsClient | null = null

/** Hanya di build pengembangan: arahkan ke server palsu untuk menguji alur tanpa key sungguhan. */
const devBase = (name: string): string | undefined => (app.isPackaged ? undefined : process.env[name])

/** Key dibaca tiap permintaan, jadi key yang baru diisi di Settings langsung dipakai tanpa restart. */
export function getGemini(): GeminiClient {
  if (!gemini) gemini = createGeminiClient({ apiKey: () => getSecret('gemini'), base: devBase('YOUFARM_FAKE_GEMINI') })
  return gemini
}

export function getPexels(): PexelsClient {
  if (!pexels) pexels = createPexelsClient({ apiKey: () => getSecret('pexels'), base: devBase('YOUFARM_FAKE_PEXELS') })
  return pexels
}
