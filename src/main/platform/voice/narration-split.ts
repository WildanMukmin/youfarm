import { pcmToWav } from '../ai/gemini-client.ts'

export interface Silence {
  start: number
  end: number
}

const FRAME_MS = 10
/** Jeda lebih pendek dari ini bukan batas kalimat. */
const MIN_SILENCE_SEC = 0.12
/** Frame dianggap hening bila energinya di bawah rasio ini dari energi bicara (persentil 90). */
const SILENCE_RATIO = 0.05
/** Sisa hening yang dipertahankan di tepi tiap potongan supaya ujung kata tidak terpotong. */
const EDGE_SEC = 0.08
const MIN_SEGMENT_SEC = 0.4

/** Lokasi jeda dalam PCM 16-bit mono, dalam detik. */
export function findSilences(pcm: Int16Array, rate: number): Silence[] {
  const frame = Math.max(1, Math.round((rate * FRAME_MS) / 1000))
  const frames = Math.floor(pcm.length / frame)
  if (frames < 2) return []
  const rms = new Float64Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += pcm[i] * pcm[i]
    rms[f] = Math.sqrt(sum / frame)
  }
  const sorted = [...rms].sort((a, b) => a - b)
  const speech = sorted[Math.floor(sorted.length * 0.9)]
  if (speech <= 0) return []
  const limit = speech * SILENCE_RATIO

  const out: Silence[] = []
  let from = -1
  const close = (to: number): void => {
    const start = (from * frame) / rate
    const end = (to * frame) / rate
    if (end - start >= MIN_SILENCE_SEC) out.push({ start, end })
    from = -1
  }
  for (let f = 0; f < frames; f++) {
    if (rms[f] < limit) {
      if (from < 0) from = f
    } else if (from >= 0) close(f)
  }
  if (from >= 0) close(frames)
  return out
}

/**
 * Pilih `weights.length - 1` jeda sebagai batas kalimat. Posisi batas diperkirakan dari panjang teks tiap kalimat,
 * lalu jeda terpanjang di sekitar perkiraan itu dipilih. Tanpa jeda yang cocok, batas jatuh di posisi perkiraan.
 * `estimated` menghitung batas yang memakai perkiraan.
 */
export function chooseCuts(silences: Silence[], weights: number[], totalSec: number): { cuts: Silence[]; estimated: number } {
  const n = weights.length
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const avg = totalSec / n
  const cuts: Silence[] = []
  let estimated = 0
  let acc = 0
  let floor = 0
  for (let k = 0; k < n - 1; k++) {
    acc += weights[k]
    const target = (totalSec * acc) / sum
    let best: Silence | null = null
    let bestScore = -Infinity
    for (const s of silences) {
      const mid = (s.start + s.end) / 2
      if (mid < floor + MIN_SEGMENT_SEC || Math.abs(mid - target) > avg * 0.6) continue
      const score = s.end - s.start - (0.5 * Math.abs(mid - target)) / avg
      if (score > bestScore) {
        best = s
        bestScore = score
      }
    }
    if (!best) {
      estimated++
      const t = Math.min(Math.max(target, floor + MIN_SEGMENT_SEC), totalSec - MIN_SEGMENT_SEC * (n - 1 - k))
      best = { start: t, end: t }
    }
    cuts.push(best)
    floor = (best.start + best.end) / 2
  }
  return { cuts, estimated }
}

export interface SplitResult {
  /** Satu WAV mono 16-bit per kalimat. */
  wavs: Buffer[]
  /** Jumlah batas yang tidak menemukan jeda dan memakai perkiraan waktu. */
  estimated: number
}

/** Potong satu narasi WAV (hasil pcmToWav) menjadi satu WAV per kalimat, berdasarkan panjang teks tiap kalimat. */
export function splitNarration(wav: Buffer, texts: string[]): SplitResult {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Narasi bukan berkas WAV.')
  const rate = wav.readUInt32LE(24)
  const data = wav.subarray(44)
  const pcm = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2)))
  const total = pcm.length / rate
  if (texts.length === 1) return { wavs: [wav], estimated: 0 }

  const weights = texts.map((t) => Math.max(1, [...t.replace(/[\s\p{P}]/gu, '')].length))
  const { cuts, estimated } = chooseCuts(findSilences(pcm, rate), weights, total)

  const wavs: Buffer[] = []
  let start = 0
  for (let k = 0; k < texts.length; k++) {
    const cut = cuts[k]
    // Potongan berakhir sedikit setelah ucapan terakhir, dan berikutnya mulai sedikit sebelum ucapan baru.
    const end = cut ? Math.min(cut.start + EDGE_SEC, (cut.start + cut.end) / 2) : total
    const next = cut ? Math.max(cut.end - EDGE_SEC, (cut.start + cut.end) / 2) : total
    const a = Math.round(start * rate)
    const b = Math.round(end * rate)
    wavs.push(pcmToWav(Buffer.from(pcm.buffer, pcm.byteOffset + a * 2, (b - a) * 2), rate))
    start = next
  }
  return { wavs, estimated }
}
