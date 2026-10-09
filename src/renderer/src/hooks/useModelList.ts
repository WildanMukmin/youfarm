import { useCallback, useEffect, useState } from 'react'
import { splitGeminiModels } from '@shared/settings'
import { errMsg } from '@/lib/errors'

export type ModelProvider = 'gemini' | 'groq'

// Daftar model per penyedia disimpan selama aplikasi terbuka, jadi pindah menu tidak memanggil API lagi.
const cache = new Map<ModelProvider, string[]>()

const fetchers: Record<ModelProvider, () => Promise<string[]>> = {
  gemini: () => window.youfarm.ai.geminiModels(),
  groq: () => window.youfarm.ai.groqModels()
}

/** Daftar model dari API penyedia (Gemini dipisah jadi teks dan suara). Dimuat otomatis begitu `enabled`. */
export function useModelList(provider: ModelProvider, enabled: boolean) {
  const [models, setModels] = useState<string[]>(() => cache.get(provider) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchers[provider]()
      cache.set(provider, list)
      setModels(list)
    } catch (e) {
      setError(errMsg(e, 'Gagal memuat daftar model.'))
    } finally {
      setLoading(false)
    }
  }, [provider])

  useEffect(() => {
    setModels(cache.get(provider) ?? [])
    if (enabled && !cache.has(provider)) void load()
  }, [provider, enabled, load])

  const split = provider === 'gemini' ? splitGeminiModels(models) : { text: models, tts: [] as string[] }
  return { text: split.text, tts: split.tts, loading, error, reload: load }
}
