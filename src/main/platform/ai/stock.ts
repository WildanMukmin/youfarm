import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** Bagian bersama penyedia footage stock (Pixabay, Pexels): tipe, pemilihan footage, dan unduhan bercache. */

const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024

export type StockErrorKind = 'key' | 'quota' | 'retry' | 'bad'

export class StockError extends Error {
  readonly kind: StockErrorKind
  constructor(kind: StockErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface StockVideo {
  id: number
  duration: number
  width: number
  height: number
  /** Berkas mp4 terpilih. */
  fileUrl: string
  pageUrl: string
}

export interface StockClient {
  search(query: string, signal?: AbortSignal): Promise<StockVideo[]>
  /** Unduh ke `cacheDir`; berkas yang sudah ada dipakai ulang. */
  download(video: StockVideo, cacheDir: string, signal?: AbortSignal): Promise<string>
}

/**
 * Pilih footage untuk satu segmen: belum dipakai, durasi tidak terlalu pendek (agar tidak terlihat
 * berulang), dan lebih disukai yang berorientasi vertikal.
 */
export function pickVideo(candidates: StockVideo[], p: { neededSec: number; used: Set<number> }): StockVideo | null {
  const fresh = candidates.filter((c) => !p.used.has(c.id))
  const score = (c: StockVideo): number => (c.height >= c.width ? 100 : 0) + Math.min(c.duration, p.neededSec) * 5 + (c.duration >= p.neededSec ? 20 : 0)
  return fresh.sort((a, b) => score(b) - score(a))[0] ?? null
}

/** Unduh `video` ke `<cacheDir>/<prefix>-<id>.mp4` lewat berkas .part; berkas yang sudah ada dipakai ulang. */
export async function downloadCached(video: StockVideo, p: { cacheDir: string; prefix: string; provider: string; signal?: AbortSignal }): Promise<string> {
  const dest = join(p.cacheDir, `${p.prefix}-${video.id}.mp4`)
  try {
    if ((await stat(dest)).size > 0) return dest
  } catch {
    /* belum ada */
  }
  await mkdir(dirname(dest), { recursive: true })
  let res: Response
  try {
    res = await fetch(video.fileUrl, { signal: p.signal ?? AbortSignal.timeout(180_000) })
  } catch (e) {
    if (p.signal?.aborted) throw e
    throw new StockError('retry', `Gagal mengunduh footage dari ${p.provider}.`)
  }
  if (!res.ok || !res.body) throw new StockError('retry', `Unduhan footage gagal (HTTP ${res.status}).`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_DOWNLOAD_BYTES) throw new StockError('bad', 'Berkas footage terlalu besar.')
  const tmp = `${dest}.part`
  try {
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp))
    await rename(tmp, dest)
  } catch (e) {
    await unlink(tmp).catch(() => undefined)
    throw e
  }
  return dest
}
