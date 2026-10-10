const FRAME_MS = 10
/** Semburan di ujung maksimal selama ini; lebih panjang dianggap ucapan sungguhan. */
const MAX_BURST_SEC = 0.3
/** Sebelum semburan harus ada sunyi sedikitnya selama ini. */
const MIN_GAP_SEC = 0.1
/** Frame sunyi: energinya di bawah rasio ini dari energi bicara (persentil 90). */
const QUIET_RATIO = 0.05
/** Frame semburan: peak mendekati skala penuh. */
const FULL_SCALE = 0.9 * 32767

/**
 * Gemini TTS menutup audio dengan semburan derau skala penuh (sekitar 0,12 dtk) setelah ucapan selesai dan jeda sunyi.
 * Di video itu terdengar sebagai kresek keras di ujung. Fungsi ini memotong semburan itu, dan hanya itu: ucapan asli
 * tidak pernah berakhir dengan peak skala penuh di hampir tiap frame setelah jeda senyap, jadi ucapan yang wajar utuh.
 * Mengembalikan indeks sampel tempat semburan mulai, atau panjang penuh bila tidak ada semburan.
 */
export function tailBurstStart(pcm: Int16Array, rate: number): number {
  const frame = Math.max(1, Math.round((rate * FRAME_MS) / 1000))
  const frames = Math.floor(pcm.length / frame)
  if (frames < 20) return pcm.length
  const rms = new Float64Array(frames)
  const peak = new Float64Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    let pk = 0
    for (let i = f * frame; i < (f + 1) * frame; i++) {
      sum += pcm[i] * pcm[i]
      pk = Math.max(pk, Math.abs(pcm[i]))
    }
    rms[f] = Math.sqrt(sum / frame)
    peak[f] = pk
  }
  const speech = [...rms].sort((a, b) => a - b)[Math.floor(frames * 0.9)]
  if (speech <= 0) return pcm.length

  // Frame paling belakang yang bukan sunyi membentuk kandidat semburan.
  const quiet = speech * QUIET_RATIO
  let burstFrom = frames
  while (burstFrom > 0 && rms[burstFrom - 1] >= quiet) burstFrom--
  const burstFrames = frames - burstFrom
  if (burstFrames === 0 || burstFrames * FRAME_MS > MAX_BURST_SEC * 1000) return pcm.length

  let loud = 0
  for (let f = burstFrom; f < frames; f++) if (peak[f] >= FULL_SCALE) loud++
  if (loud < burstFrames * 0.8) return pcm.length

  // Harus didahului sunyi (bukan sambungan ucapan).
  let gap = 0
  while (burstFrom - gap > 0 && rms[burstFrom - gap - 1] < quiet) gap++
  if (gap * FRAME_MS < MIN_GAP_SEC * 1000) return pcm.length
  return burstFrom * frame
}
