/** Mengurai respons `GET /v1beta/models` dari Gemini API menjadi daftar nama model untuk teks. */
export function parseGeminiModels(json: unknown): string[] {
  const models = (json as { models?: unknown })?.models
  if (!Array.isArray(models)) return []
  const names: string[] = []
  for (const m of models) {
    const name = (m as { name?: unknown }).name
    const methods = (m as { supportedGenerationMethods?: unknown }).supportedGenerationMethods
    if (typeof name !== 'string' || !Array.isArray(methods) || !methods.includes('generateContent')) continue
    const id = name.replace(/^models\//, '')
    if (id.startsWith('gemini')) names.push(id)
  }
  return names.sort()
}
