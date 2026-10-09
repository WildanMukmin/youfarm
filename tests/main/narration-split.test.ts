import assert from 'node:assert/strict'
import test from 'node:test'
import { pcmToWav } from '../../src/main/platform/ai/gemini-client.ts'
import { chooseCuts, findSilences, splitNarration } from '../../src/main/platform/voice/narration-split.ts'

const RATE = 24000

/** Rangkaian [detik, bunyi?]: nada 220 Hz untuk bunyi, nol untuk hening. */
function build(parts: [number, boolean][]): Int16Array {
  const out: number[] = []
  for (const [sec, voiced] of parts) {
    const n = Math.round(sec * RATE)
    for (let i = 0; i < n; i++) out.push(voiced ? Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / RATE)) : 0)
  }
  return Int16Array.from(out)
}

const wavOf = (pcm: Int16Array): Buffer => pcmToWav(Buffer.from(pcm.buffer), RATE)
const secs = (wav: Buffer): number => (wav.length - 44) / 2 / RATE

test('findSilences: jeda panjang ketemu, jeda sangat pendek diabaikan', () => {
  const pcm = build([[1, true], [0.4, false], [1, true], [0.05, false], [1, true]])
  const s = findSilences(pcm, RATE)
  assert.equal(s.length, 1)
  assert.ok(Math.abs(s[0].start - 1) < 0.03 && Math.abs(s[0].end - 1.4) < 0.03)
  assert.deepEqual(findSilences(new Int16Array(RATE), RATE), [])
})

test('chooseCuts: memilih jeda antar kalimat, bukan jeda koma di tengah kalimat', () => {
  // Kalimat 1: 0-2 dtk. Kalimat 2: 2.5-5.5 dtk dengan koma di 4.0. Kalimat 3: 6.0-7.5 dtk.
  const silences = [{ start: 2.0, end: 2.5 }, { start: 4.0, end: 4.15 }, { start: 5.5, end: 6.0 }]
  const { cuts, estimated } = chooseCuts(silences, [20, 30, 15], 7.5)
  assert.equal(estimated, 0)
  assert.deepEqual(cuts, [silences[0], silences[2]])
})

test('chooseCuts: tanpa jeda yang cocok, batas diperkirakan dari panjang teks', () => {
  const { cuts, estimated } = chooseCuts([], [10, 10, 10, 10], 8)
  assert.equal(estimated, 3)
  assert.deepEqual(cuts.map((c) => Math.round(c.start * 10) / 10), [2, 4, 6])
})

test('splitNarration: satu WAV per kalimat, panjangnya mengikuti ucapan', () => {
  const wav = wavOf(build([[2, true], [0.5, false], [1.5, true], [0.15, false], [1.5, true], [0.5, false], [1.5, true]]))
  // Teks kalimat 2 berisi koma; panjangnya sebanding dengan 3.15 dtk ucapan.
  const { wavs, estimated } = splitNarration(wav, ['a'.repeat(20), 'b'.repeat(15) + ', ' + 'c'.repeat(16), 'd'.repeat(15)])
  assert.equal(estimated, 0)
  assert.equal(wavs.length, 3)
  for (const w of wavs) assert.equal(w.toString('ascii', 0, 4), 'RIFF')
  // Ucapan + sisa tepi ~0.08 dtk, jauh lebih pendek daripada seluruh jeda 0.5 dtk.
  assert.ok(Math.abs(secs(wavs[0]) - 2.08) < 0.1, String(secs(wavs[0])))
  assert.ok(Math.abs(secs(wavs[1]) - 3.31) < 0.2, String(secs(wavs[1])))
  assert.ok(Math.abs(secs(wavs[2]) - 1.58) < 0.1, String(secs(wavs[2])))
  assert.deepEqual(splitNarration(wav, ['satu']).wavs, [wav])
  assert.throws(() => splitNarration(Buffer.alloc(10), ['a', 'b']), /bukan berkas WAV/)
})
