import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StockError, downloadCached, type StockClient, type StockVideo } from './stock.ts'

const BASE = 'https://pixabay.com/api'
/** Syarat API Pixabay: hasil pencarian dicache 24 jam. */
export const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000
/** Rendisi di atas ukuran ini tidak dipilih (rendisi 4K bisa ratusan MB). */
const MAX_RENDITION_BYTES = 150 * 1024 * 1024
/** Saat kena batas 100 permintaan per menit, tunggu sampai jendela berikutnya bila tidak lebih lama dari ini. */
const MAX_RATE_WAIT_SEC = 65

interface RawRendition {
  url?: string
  width?: number
  height?: number
  size?: number
}
interface RawHit {
  id?: number
  pageURL?: string
  duration?: number
  videos?: Record<string, RawRendition | undefined>
}

/**
 * Pilih rendisi terkecil yang sisi pendeknya ≥ 1080. Footage Pixabay kebanyakan lanskap dan di-crop ke 9:16,
 * jadi tinggi frame yang menentukan ketajaman. Bila tak ada, pakai yang terbesar. Rendisi kosong dilewati.
 */
export function pickRendition(videos: RawHit['videos']): RawRendition | null {
  const list = Object.values(videos ?? {}).filter(
    (r): r is RawRendition => Boolean(r?.url && r.width && r.height && (!r.size || r.size <= MAX_RENDITION_BYTES))
  )
  if (list.length === 0) return null
  const area = (r: RawRendition): number => r.width! * r.height!
  const enough = list.filter((r) => Math.min(r.width!, r.height!) >= 1080).sort((a, b) => area(a) - area(b))
  return enough[0] ?? list.sort((a, b) => area(b) - area(a))[0]
}

export function normalizeHits(json: unknown): StockVideo[] {
  const hits = (json as { hits?: RawHit[] })?.hits
  if (!Array.isArray(hits)) return []
  const out: StockVideo[] = []
  for (const h of hits) {
    const r = pickRendition(h.videos)
    if (!h.id || !r || !h.duration) continue
    out.push({ id: h.id, duration: h.duration, width: r.width!, height: r.height!, fileUrl: r.url!, pageUrl: h.pageURL ?? '' })
  }
  return out
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true })
  })
}

export interface PixabayOptions {
  apiKey: () => string | undefined
  base?: string
  /** Folder cache hasil pencarian. Tanpa ini hanya dicache di memori. */
  searchCacheDir?: string
  now?: () => number
}

export function createPixabayClient(opts: PixabayOptions): StockClient {
  const base = opts.base ?? BASE
  const now = opts.now ?? Date.now
  const memory = new Map<string, { at: number; videos: StockVideo[] }>()
  let pruned = false

  const cacheFile = (id: string): string | null => (opts.searchCacheDir ? join(opts.searchCacheDir, `${id}.json`) : null)

  async function readCache(id: string): Promise<StockVideo[] | null> {
    const hit = memory.get(id)
    if (hit && now() - hit.at < SEARCH_CACHE_MS) return hit.videos
    const file = cacheFile(id)
    if (!file) return null
    try {
      const saved = JSON.parse(await readFile(file, 'utf8')) as { at?: number; videos?: StockVideo[] }
      if (typeof saved.at !== 'number' || !Array.isArray(saved.videos) || now() - saved.at >= SEARCH_CACHE_MS) return null
      memory.set(id, { at: saved.at, videos: saved.videos })
      return saved.videos
    } catch {
      return null
    }
  }

  async function writeCache(id: string, videos: StockVideo[]): Promise<void> {
    const entry = { at: now(), videos }
    memory.set(id, entry)
    const file = cacheFile(id)
    if (!file) return
    await mkdir(opts.searchCacheDir!, { recursive: true })
    await writeFile(file, JSON.stringify(entry))
    if (!pruned) {
      pruned = true
      void pruneCache()
    }
  }

  /** Hapus hasil pencarian yang sudah lewat 24 jam supaya folder cache tidak terus membesar. */
  async function pruneCache(): Promise<void> {
    const dir = opts.searchCacheDir!
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      if (!name.endsWith('.json')) continue
      const p = join(dir, name)
      const s = await stat(p).catch(() => null)
      if (s && now() - s.mtimeMs >= SEARCH_CACHE_MS) await rm(p, { force: true })
    }
  }

  return {
    async search(query, signal) {
      const key = opts.apiKey()
      if (!key) throw new StockError('key', 'Key Pixabay belum diisi (Settings > API).')
      const q = query.replace(/\s+/g, ' ').trim().slice(0, 100)
      const id = createHash('sha1').update(q.toLowerCase()).digest('hex')
      const cached = await readCache(id)
      if (cached) return cached

      const url = `${base}/videos/?${new URLSearchParams({ key, q, video_type: 'film', safesearch: 'true', per_page: '20' })}`
      for (let attempt = 0; ; attempt++) {
        let res: Response
        try {
          res = await fetch(url, { signal: signal ?? AbortSignal.timeout(20_000) })
        } catch (e) {
          if (signal?.aborted) throw e
          throw new StockError('retry', 'Tidak bisa terhubung ke Pixabay. Periksa koneksi internet.')
        }
        if (res.status === 429) {
          const reset = Number(res.headers.get('x-ratelimit-reset'))
          if (attempt === 0 && Number.isFinite(reset) && reset >= 0 && reset <= MAX_RATE_WAIT_SEC) {
            await wait((reset + 1) * 1000, signal)
            continue
          }
          throw new StockError('quota', 'Batas permintaan Pixabay (100 per menit) tercapai. Coba lagi sebentar lagi.')
        }
        if (res.status === 401 || res.status === 403) throw new StockError('key', 'Key Pixabay ditolak. Periksa key di Settings > API.')
        if (res.status === 400) {
          // Pixabay menjawab 400 dengan teks biasa, mis. `[ERROR 400] "key" is wrong or missing.`
          const text = await res.text().catch(() => '')
          if (/key/i.test(text)) throw new StockError('key', 'Key Pixabay ditolak. Periksa key di Settings > API.')
          throw new StockError('bad', `Pixabay menolak pencarian "${q}".`)
        }
        if (!res.ok) throw new StockError('retry', `Pixabay menjawab ${res.status}.`)
        const videos = normalizeHits(await res.json().catch(() => ({})))
        await writeCache(id, videos)
        return videos
      }
    },

    download: (video, cacheDir, signal) => downloadCached(video, { cacheDir, prefix: 'pixabay', provider: 'Pixabay', signal })
  }
}
