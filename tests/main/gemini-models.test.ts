import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGeminiModels } from '../../src/main/platform/ai/gemini-models.ts'

test('parseGeminiModels hanya mengambil model gemini yang mendukung generateContent', () => {
  const out = parseGeminiModels({
    models: [
      { name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-a', supportedGenerationMethods: ['generateContent', 'countTokens'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-embed', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/imagen-3', supportedGenerationMethods: ['generateContent'] },
      { nama: 'rusak' }
    ]
  })
  assert.deepEqual(out, ['gemini-a', 'gemini-b'])
})

test('parseGeminiModels aman terhadap respons aneh', () => {
  assert.deepEqual(parseGeminiModels(null), [])
  assert.deepEqual(parseGeminiModels({}), [])
  assert.deepEqual(parseGeminiModels({ models: 'x' }), [])
})
