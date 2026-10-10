import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tailBurstStart } from '../../src/main/platform/voice/pcm.ts'

const RATE = 24000
const sec = (s: number): number => Math.round(s * RATE)

/** Ucapan tiruan: sinus berdenyut dengan amplitudo sedang, berakhir meredup. */
function speech(seconds: number, amp = 6000): Int16Array {
  const out = new Int16Array(sec(seconds))
  for (let i = 0; i < out.length; i++) out[i] = Math.round(amp * Math.sin((2 * Math.PI * 220 * i) / RATE) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 3 * i) / RATE)))
  return out
}
const quiet = (seconds: number): Int16Array => Int16Array.from({ length: sec(seconds) }, (_, i) => (i % 2 ? 4 : -4))
/** Semburan skala penuh seperti penutup audio Gemini. */
const burst = (seconds: number): Int16Array => Int16Array.from({ length: sec(seconds) }, (_, i) => (i % 7 < 4 ? 32767 : -32768))
const join = (...parts: Int16Array[]): Int16Array => {
  const out = new Int16Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) (out.set(p, at), (at += p.length))
  return out
}

test('tailBurstStart: semburan skala penuh setelah jeda sunyi di ujung dipotong', () => {
  const body = join(speech(3), quiet(0.4))
  const pcm = join(body, burst(0.12))
  assert.equal(tailBurstStart(pcm, RATE), body.length)
})

test('tailBurstStart: ucapan wajar tidak dipotong, termasuk kata pendek di ujung dan ucapan yang keras', () => {
  const plain = join(speech(3), quiet(0.4))
  assert.equal(tailBurstStart(plain, RATE), plain.length)
  // Kata penutup pendek setelah jeda, tetapi tidak berupa semburan skala penuh.
  const word = join(speech(3), quiet(0.3), speech(0.2, 9000))
  assert.equal(tailBurstStart(word, RATE), word.length)
  // Audio tanpa jeda sebelum bagian keras: bukan semburan penutup.
  const noGap = join(speech(3), burst(0.12))
  assert.equal(tailBurstStart(noGap, RATE), noGap.length)
  // Bagian keras yang panjang adalah ucapan, bukan semburan.
  const long = join(speech(3), quiet(0.4), burst(1))
  assert.equal(tailBurstStart(long, RATE), long.length)
})
