import { getGemini, getGroq } from './clients'

/** Daftar model Gemini yang bisa dipakai key pengguna. */
export function listGeminiModels(): Promise<string[]> {
  return getGemini().listModels()
}

/** Daftar model teks Groq yang aktif untuk key pengguna. */
export function listGroqModels(): Promise<string[]> {
  return getGroq().listModels()
}
