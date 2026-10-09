import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const BASE = 'https://api.pexels.com'
const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024

export type PexelsErrorKind = 'key' | 'quota' | 'retry' | 'bad'

export class PexelsError extends Error {
  readonly kind: PexelsErrorKind
  constructor(kind: PexelsErrorKind, message: string) {
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

interface RawFile {
  quality?: string
  file_type?: string
  width?: number
  height?: number
  link?: string
}
interface RawVideo {
  id?: number
  duration?: number
  width?: number
  height?: number
  url?: string
  video_files?: RawFile[]
}

/** Pilih berkas mp4 terkecil yang tingginya ≥ 1280 (cukup untuk 1080x1920); bila tak ada, yang terbesar. */
export function pickFile(files: RawFile[]): RawFile | null {
  const mp4 = files.filter((f) => f.link && (f.file_type === 'video/mp4' || f.link.includes('.mp4')) && f.width && f.height)
  if (mp4.length === 0) return null
  const enough = mp4.filter((f) => Math.max(f.width!, f.height!) >= 1280).sort((a, b) => a.width! * a.height! - b.width! * b.height!)
  return enough[0] ?? mp4.sort((a, b) => b.width! * b.height! - a.width! * a.height!)[0]
}

export function normalizeVideos(json: unknown): StockVideo[] {
  const list = (json as { videos?: RawVideo[] })?.videos
  if (!Array.isArray(list)) return []
  const out: StockVideo[] = []
  for (const v of list) {
    const file = pickFile(v.video_files ?? [])
    if (!v.id || !file || !v.duration) continue
    out.push({ id: v.id, duration: v.duration, width: file.width!, height: file.height!, fileUrl: file.link!, pageUrl: v.url ?? '' })
  }
  return out
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

export interface PexelsClient {
  search(query: string, signal?: AbortSignal): Promise<StockVideo[]>
  /** Unduh ke `cacheDir`; berkas yang sudah ada dipakai ulang. */
  download(video: StockVideo, cacheDir: string, signal?: AbortSignal): Promise<string>
}

export function createPexelsClient(opts: { apiKey: () => string | undefined; base?: string }): PexelsClient {
  const base = opts.base ?? BASE

  return {
    async search(query, signal) {
      const key = opts.apiKey()
      if (!key) throw new PexelsError('key', 'Key Pexels belum diisi (Settings > API).')
      const url = `${base}/videos/search?${new URLSearchParams({ query, orientation: 'portrait', size: 'medium', per_page: '15' })}`
      let res: Response
      try {
        res = await fetch(url, { headers: { Authorization: key }, signal: signal ?? AbortSignal.timeout(20_000) })
      } catch (e) {
        if (signal?.aborted) throw e
        throw new PexelsError('retry', 'Tidak bisa terhubung ke Pexels. Periksa koneksi internet.')
      }
      if (res.status === 401 || res.status === 403) throw new PexelsError('key', 'Key Pexels ditolak. Periksa key di Settings > API.')
      if (res.status === 429) throw new PexelsError('quota', 'Batas permintaan Pexels (200 per jam) tercapai. Coba lagi nanti.')
      if (!res.ok) throw new PexelsError('retry', `Pexels menjawab ${res.status}.`)
      return normalizeVideos(await res.json().catch(() => ({})))
    },

    async download(video, cacheDir, signal) {
      const dest = join(cacheDir, `pexels-${video.id}.mp4`)
      try {
        if ((await stat(dest)).size > 0) return dest
      } catch {
        /* belum ada */
      }
      await mkdir(dirname(dest), { recursive: true })
      let res: Response
      try {
        res = await fetch(video.fileUrl, { signal: signal ?? AbortSignal.timeout(180_000) })
      } catch (e) {
        if (signal?.aborted) throw e
        throw new PexelsError('retry', 'Gagal mengunduh footage dari Pexels.')
      }
      if (!res.ok || !res.body) throw new PexelsError('retry', `Unduhan footage gagal (HTTP ${res.status}).`)
      const len = Number(res.headers.get('content-length') ?? 0)
      if (len > MAX_DOWNLOAD_BYTES) throw new PexelsError('bad', 'Berkas footage terlalu besar.')
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
  }
}
