import { join } from 'node:path'
import { spawnProcess } from './spawn-process.ts'

export class FfmpegError extends Error {
  readonly stderrTail: string
  constructor(message: string, stderrTail: string) {
    super(message)
    this.stderrTail = stderrTail
  }
}

export interface Ffmpeg {
  /** Jalankan ffmpeg. `onProgress` menerima detik keluaran yang sudah dirender. */
  run(args: string[], opts?: { signal?: AbortSignal; onProgress?: (outSec: number) => void; cwd?: string }): Promise<void>
  /** Durasi berkas media dalam detik. */
  duration(file: string): Promise<number>
  /** Lebar dan tinggi stream video pertama. */
  size(file: string): Promise<{ width: number; height: number }>
}

/** `binDir` berisi ffmpeg.exe dan ffprobe.exe. Tidak bergantung pada Electron. */
export function createFfmpeg(binDir: string): Ffmpeg {
  const ffmpeg = join(binDir, 'ffmpeg.exe')
  const ffprobe = join(binDir, 'ffprobe.exe')

  return {
    async run(args, opts = {}) {
      // -progress pipe:1 menulis pasangan kunci=nilai ke stdout; out_time_us adalah mikrodetik.
      const full = ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-nostats', ...args]
      const r = await spawnProcess(ffmpeg, full, {
        signal: opts.signal,
        cwd: opts.cwd,
        onStdoutLine: (line) => {
          const m = line.match(/^out_time_(?:us|ms)=(\d+)/)
          if (m && opts.onProgress) opts.onProgress(Number(m[1]) / 1_000_000)
        }
      })
      if (r.code !== 0) throw new FfmpegError(`ffmpeg gagal (kode ${r.code}).`, r.stderrTail)
    },

    async duration(file) {
      const r = await spawnProcess(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
      const n = Number(r.stdout.trim())
      if (r.code !== 0 || !Number.isFinite(n)) throw new FfmpegError('Tidak bisa membaca durasi media.', r.stderrTail)
      return n
    },

    async size(file) {
      const r = await spawnProcess(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file])
      const [w, h] = r.stdout.trim().split(',').map(Number)
      if (r.code !== 0 || !w || !h) throw new FfmpegError('Tidak bisa membaca ukuran video.', r.stderrTail)
      return { width: w, height: h }
    }
  }
}
