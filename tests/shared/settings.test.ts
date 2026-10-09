import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  isProviderAvailable,
  splitGeminiModels,
  mergeSettings,
  type SecretStatus
} from '../../src/shared/settings.ts'

const none: SecretStatus = { gemini: false, groq: false, deepgram: false, pixabay: false, pexels: false, elevenlabs: false }

test('mergeSettings menerima nilai valid dan mengabaikan yang tidak valid', () => {
  const s = mergeSettings(DEFAULT_SETTINGS, { theme: 'light', textProvider: 'groq', geminiTtsModel: 'x', bitrateKbps: 8000, evil: 1 })
  assert.equal(s.theme, 'light')
  assert.ok(!('textProvider' in s) && !('geminiTtsModel' in s), 'pilihan AI dipindah ke tiap mode')
  assert.ok(!('evil' in s))
  assert.ok(!('bitrateKbps' in s))
})

test('mergeSettings tidak mengubah input dan menolak patch bukan objek', () => {
  assert.equal(mergeSettings(DEFAULT_SETTINGS, null), DEFAULT_SETTINGS)
  const before = { ...DEFAULT_SETTINGS }
  mergeSettings(DEFAULT_SETTINGS, { theme: 'system' })
  assert.deepEqual(DEFAULT_SETTINGS, before)
})

test('mergeSettings: folder bisa diisi dan di-reset ke null', () => {
  const a = mergeSettings(DEFAULT_SETTINGS, { importDir: 'D:\\film' })
  assert.equal(a.importDir, 'D:\\film')
  assert.equal(mergeSettings(a, { importDir: null }).importDir, null)
  assert.equal(mergeSettings(a, { importDir: '' }).importDir, 'D:\\film')
})

test('provider cloud hanya tersedia bila key diisi', () => {
  assert.equal(isProviderAvailable('groq', none), false)
  assert.equal(isProviderAvailable('groq', { ...none, groq: true }), true)
  assert.equal(isProviderAvailable('gemini-tts', { ...none, gemini: true }), true)
  assert.equal(isProviderAvailable('piper', none), true)
})

test('splitGeminiModels memisahkan model teks dan model suara', () => {
  const r = splitGeminiModels(['gemini-2.5-flash', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-image', 'gemini-embedding-001', 'gemini-2.5-pro'])
  assert.deepEqual(r.text, ['gemini-2.5-flash', 'gemini-2.5-pro'])
  assert.deepEqual(r.tts, ['gemini-2.5-flash-preview-tts'])
})
