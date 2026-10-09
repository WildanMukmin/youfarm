import { spawn } from 'node:child_process'

export class ProcessCancelledError extends Error {
  constructor() {
    super('Proses dibatalkan.')
  }
}

export interface SpawnResult {
  code: number
  stdout: string
  /** Ekor stderr (maks 8 KB), cukup untuk pesan error tanpa membanjiri memori. */
  stderrTail: string
}

const TAIL = 8192

/**
 * Menjalankan proses anak dengan pembatalan lewat AbortSignal. Dipakai untuk semua proses berat
 * (ffmpeg, whisper, Piper). Tidak memakai shell, jadi argumen tidak perlu di-escape.
 */
export function spawnProcess(
  command: string,
  args: string[],
  opts: { signal?: AbortSignal; onStdoutLine?: (line: string) => void; cwd?: string; input?: string } = {}
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new ProcessCancelledError())

    const child = spawn(command, args, { cwd: opts.cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderrTail = ''
    let pending = ''
    let cancelled = false

    const onAbort = (): void => {
      cancelled = true
      child.kill()
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (opts.onStdoutLine) {
        pending += s
        let i: number
        while ((i = pending.indexOf('\n')) >= 0) {
          opts.onStdoutLine(pending.slice(0, i).trimEnd())
          pending = pending.slice(i + 1)
        }
      } else if (stdout.length < 1_000_000) {
        stdout += s
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-TAIL)
    })
    child.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort)
      reject(err)
    })
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (cancelled) return reject(new ProcessCancelledError())
      resolve({ code: code ?? -1, stdout, stderrTail })
    })

    if (opts.input !== undefined) child.stdin.end(opts.input)
    else child.stdin.end()
  })
}
