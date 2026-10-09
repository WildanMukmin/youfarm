import { getGemini } from './clients'

/** Daftar model Gemini yang bisa dipakai key pengguna. */
export function listGeminiModels(): Promise<string[]> {
  return getGemini().listModels()
}
