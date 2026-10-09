export const WIDTH = 1080
export const HEIGHT = 1920
export const FPS = 30

export interface ClipSegment {
  /** Berkas footage sumber. */
  path: string
  /** Lama segmen di video akhir (detik). Footage yang lebih pendek diulang. */
  duration: number
}

export interface RenderPlan {
  segments: ClipSegment[]
  /** Narasi gabungan (WAV). */
  narrationPath: string
  /** Berkas ASS relatif terhadap `cwd` ffmpeg (menghindari masalah escape path Windows di filter). */
  assFile: string
  /** Folder berisi font untuk libass, relatif terhadap `cwd`. */
  fontsDir: string
  output: string
  bitrateKbps: number
}

/**
 * Susun argumen ffmpeg: tiap segmen di-crop ke 9:16, disambung, diberi caption, lalu digabung narasi.
 * ffmpeg harus dijalankan dengan `cwd` = folder kerja yang berisi `assFile` dan `fontsDir`.
 */
export function buildRenderArgs(p: RenderPlan): string[] {
  if (p.segments.length === 0) throw new Error('Tidak ada segmen untuk dirender.')

  const args: string[] = []
  const filters: string[] = []
  p.segments.forEach((s, i) => {
    // -stream_loop sebelum -i mengulang footage pendek; -t membatasi ke durasi segmen.
    args.push('-stream_loop', '-1', '-t', s.duration.toFixed(3), '-i', s.path)
    filters.push(
      `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`
    )
  })
  const n = p.segments.length
  const concatInputs = p.segments.map((_, i) => `[v${i}]`).join('')
  filters.push(`${concatInputs}concat=n=${n}:v=1:a=0[vcat]`)
  filters.push(`[vcat]ass=${p.assFile}:fontsdir=${p.fontsDir}[vout]`)

  args.push('-i', p.narrationPath)
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-map', `${n}:a`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-b:v', `${p.bitrateKbps}k`,
    '-maxrate', `${Math.round(p.bitrateKbps * 1.4)}k`,
    '-bufsize', `${p.bitrateKbps * 2}k`,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    p.output
  )
  return args
}

/** Durasi tiap segmen: kalimat ke-i + jeda penutup, sehingga total = panjang narasi. */
export function segmentDurations(speechSec: number[], padSec: number): number[] {
  return speechSec.map((s) => s + padSec)
}
