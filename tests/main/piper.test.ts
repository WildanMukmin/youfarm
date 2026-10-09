import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPiper, listPiperVoices, pickVoice } from '../../src/main/platform/voice/piper.ts'
import { createFfmpeg } from '../../src/main/platform/ffmpeg.ts'

const ROOT = join(import.meta.dirname, '../..')
const BIN = join(ROOT, 'binaries/win-x64')
const PIPER_DIR = join(BIN, 'piper')
const MODELS = join(ROOT, 'models/piper')
const installed = existsSync(join(PIPER_DIR, 'piper.exe')) && existsSync(join(MODELS, 'id_ID-news_tts-medium.onnx')) && existsSync(join(BIN, 'ffprobe.exe'))
const skip = installed ? false : 'Piper atau ffmpeg belum terpasang (npm run setup:piper, setup:ffmpeg)'

test('listPiperVoices dan pickVoice: hanya model lengkap, pilih sesuai bahasa', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yf-voices-'))
  mkdirSync(dir, { recursive: true })
  for (const f of ['id_ID-a-medium.onnx', 'id_ID-a-medium.onnx.json', 'en_US-b-medium.onnx', 'en_US-b-medium.onnx.json', 'id_ID-rusak.onnx']) writeFileSync(join(dir, f), '')
  const v = listPiperVoices(dir)
  assert.deepEqual(v.map((x) => [x.name, x.lang]), [['en_US-b-medium', 'en'], ['id_ID-a-medium', 'id']])
  assert.equal(pickVoice(v, 'id')?.name, 'id_ID-a-medium')
  // Suara pilihan dari bahasa lain diabaikan supaya naskah tidak dibaca dengan suara bahasa yang salah.
  assert.equal(pickVoice(v, 'id', 'en_US-b-medium')?.name, 'id_ID-a-medium')
  assert.equal(pickVoice(v, 'en', 'en_US-b-medium')?.name, 'en_US-b-medium')
  assert.equal(pickVoice(v, 'fr'), null)
  assert.deepEqual(listPiperVoices(join(dir, 'tidak-ada')), [])
})

test('piper nyata: suara Indonesia jadi WAV, kalimat panjang lebih lama, bisa diperlambat', { skip }, async () => {
  const piper = createPiper({ piperDir: PIPER_DIR, modelsDir: MODELS })
  const ff = createFfmpeg(BIN)
  const voice = pickVoice(piper.voices(), 'id')!
  const dir = mkdtempSync(join(tmpdir(), 'yf-piper-'))

  await piper.synth({ text: 'Halo.', voice, out: join(dir, 'a.wav') })
  await piper.synth({ text: 'Laut dalam menyimpan banyak rahasia yang belum pernah dilihat manusia sama sekali.', voice, out: join(dir, 'b.wav') })
  await piper.synth({ text: 'Halo.', voice, out: join(dir, 'c.wav'), lengthScale: 1.6 })
  const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => ff.duration(join(dir, `${n}.wav`))))
  assert.ok(a > 0.2 && a < 3, `a=${a}`)
  assert.ok(b > a * 3, `kalimat panjang harus jauh lebih lama (a=${a}, b=${b})`)
  assert.ok(c > a * 1.3, `length_scale 1.6 harus memperlambat (a=${a}, c=${c})`)
})
