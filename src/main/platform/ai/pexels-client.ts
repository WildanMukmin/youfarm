import { StockError, downloadCached, type StockClient, type StockVideo } from './stock.ts'

const BASE = 'https://api.pexels.com'

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

export function createPexelsClient(opts: { apiKey: () => string | undefined; base?: string }): StockClient {
  const base = opts.base ?? BASE

  return {
    async search(query, signal) {
      const key = opts.apiKey()
      if (!key) throw new StockError('key', 'Key Pexels belum diisi (Settings > API).')
      const url = `${base}/videos/search?${new URLSearchParams({ query, orientation: 'portrait', size: 'medium', per_page: '15' })}`
      let res: Response
      try {
        res = await fetch(url, { headers: { Authorization: key }, signal: signal ?? AbortSignal.timeout(20_000) })
      } catch (e) {
        if (signal?.aborted) throw e
        throw new StockError('retry', 'Tidak bisa terhubung ke Pexels. Periksa koneksi internet.')
      }
      if (res.status === 401 || res.status === 403) throw new StockError('key', 'Key Pexels ditolak. Periksa key di Settings > API.')
      if (res.status === 429) throw new StockError('quota', 'Batas permintaan Pexels (200 per jam) tercapai. Coba lagi nanti.')
      if (!res.ok) throw new StockError('retry', `Pexels menjawab ${res.status}.`)
      return normalizeVideos(await res.json().catch(() => ({})))
    },

    download: (video, cacheDir, signal) => downloadCached(video, { cacheDir, prefix: 'pexels', provider: 'Pexels', signal })
  }
}
