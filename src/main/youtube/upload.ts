import { open, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import type { UploadBody } from '../../shared/youtube/metadata.ts'
import { classifyYoutubeError, reasonFromBody, type ClassifiedError } from '../../shared/youtube/errors.ts'

/** Error dari YouTube API dengan klasifikasi siap pakai untuk antrean. */
export class YoutubeApiError extends Error {
  readonly status: number
  readonly reason: string
  readonly classified: ClassifiedError
  constructor(status: number, reason: string, network = false) {
    const classified = classifyYoutubeError({ status, reason, network })
    super(classified.message)
    this.status = status
    this.reason = reason
    this.classified = classified
  }
}

/** Potongan harus kelipatan 256 KB (syarat Google). */
export const DEFAULT_CHUNK = 8 * 1024 * 1024

export interface UploadedVideo {
  id: string
  privacy: string
  publishAt: string | null
}

async function apiError(res: Response): Promise<YoutubeApiError> {
  const body = await res.json().catch(() => ({}))
  return new YoutubeApiError(res.status, reasonFromBody(body))
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Upload dibatalkan.'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(new Error('Upload dibatalkan.'))), { once: true })
  })

async function put(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    // 308 dipakai Google sebagai "lanjutkan", jadi redirect tidak boleh diikuti.
    return await fetch(url, { ...init, redirect: 'manual', signal })
  } catch (e) {
    if (signal?.aborted) throw new Error('Upload dibatalkan.')
    throw new YoutubeApiError(0, '', true)
  }
}

/** "bytes=0-1048575" -> jumlah byte yang sudah diterima server. */
function receivedFromRange(range: string | null): number {
  const m = range?.match(/bytes=0-(\d+)/)
  return m ? Number(m[1]) + 1 : 0
}

function toVideo(body: unknown): UploadedVideo {
  const v = body as { id?: string; status?: { privacyStatus?: string; publishAt?: string } }
  if (!v?.id) throw new YoutubeApiError(500, '')
  return { id: v.id, privacy: v.status?.privacyStatus ?? 'unknown', publishAt: v.status?.publishAt ?? null }
}

/**
 * Upload resumable. Bila potongan gagal (jaringan atau 5xx), status sesi ditanyakan ke Google
 * dan upload dilanjutkan dari byte terakhir yang diterima, bukan diulang dari awal.
 */
export async function uploadVideo(p: {
  accessToken: string
  filePath: string
  body: UploadBody
  apiBase: string
  signal?: AbortSignal
  onProgress?: (sentBytes: number, totalBytes: number) => void
  chunkSize?: number
  maxRetries?: number
  retryDelayMs?: number
}): Promise<UploadedVideo> {
  const chunkSize = p.chunkSize ?? DEFAULT_CHUNK
  const maxRetries = p.maxRetries ?? 5
  const retryDelay = p.retryDelayMs ?? 1500

  const size = (await stat(p.filePath)).size
  if (size === 0) throw new YoutubeApiError(400, 'mediaBodyRequired')

  const init = await put(
    `${p.apiBase}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': 'video/*'
      },
      body: JSON.stringify(p.body)
    },
    p.signal
  )
  if (!init.ok) throw await apiError(init)
  const session = init.headers.get('location')
  if (!session) throw new YoutubeApiError(500, '')

  const file = await open(p.filePath, 'r')
  try {
    let offset = 0
    let failures = 0
    p.onProgress?.(0, size)

    while (true) {
      const end = Math.min(offset + chunkSize, size)
      let res: Response
      try {
        const buf = Buffer.alloc(end - offset)
        await file.read(buf, 0, buf.length, offset)
        res = await put(
          session,
          {
            method: 'PUT',
            headers: { 'Content-Length': String(buf.length), 'Content-Range': `bytes ${offset}-${end - 1}/${size}` },
            body: buf
          },
          p.signal
        )
        if (res.status >= 500) throw new YoutubeApiError(res.status, '')
      } catch (e) {
        if (!(e instanceof YoutubeApiError) || e.classified.kind !== 'retry') throw e
        if (++failures > maxRetries) throw e
        await sleep(retryDelay * 2 ** (failures - 1), p.signal)
        // Tanya server sudah menerima sampai mana.
        const q = await put(session, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': `bytes */${size}` } }, p.signal).catch(() => null)
        if (q?.status === 308) offset = receivedFromRange(q.headers.get('range'))
        else if (q && (q.status === 200 || q.status === 201)) return toVideo(await q.json())
        else if (q?.status === 404) throw new YoutubeApiError(404, '')
        continue
      }

      if (res.status === 200 || res.status === 201) {
        p.onProgress?.(size, size)
        return toVideo(await res.json())
      }
      if (res.status === 308) {
        failures = 0
        offset = receivedFromRange(res.headers.get('range'))
        p.onProgress?.(offset, size)
        continue
      }
      throw await apiError(res)
    }
  } finally {
    await file.close()
  }
}

const THUMB_MAX_BYTES = 2 * 1024 * 1024

export async function setThumbnail(p: { accessToken: string; videoId: string; filePath: string; apiBase: string; signal?: AbortSignal }): Promise<void> {
  const ext = extname(p.filePath).toLowerCase()
  const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : null
  if (!type) throw new YoutubeApiError(400, 'invalidImage')
  const { size } = await stat(p.filePath)
  if (size > THUMB_MAX_BYTES) throw new YoutubeApiError(413, 'thumbnailTooLarge')
  const f = await open(p.filePath, 'r')
  try {
    const buf = Buffer.alloc(size)
    await f.read(buf, 0, size, 0)
    const res = await put(
      `${p.apiBase}/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(p.videoId)}`,
      { method: 'POST', headers: { Authorization: `Bearer ${p.accessToken}`, 'Content-Type': type }, body: buf },
      p.signal
    )
    if (!res.ok) throw await apiError(res)
  } finally {
    await f.close()
  }
}

export async function addToPlaylist(p: { accessToken: string; playlistId: string; videoId: string; apiBase: string; signal?: AbortSignal }): Promise<void> {
  const res = await put(
    `${p.apiBase}/youtube/v3/playlistItems?part=snippet`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { playlistId: p.playlistId, resourceId: { kind: 'youtube#video', videoId: p.videoId } } })
    },
    p.signal
  )
  if (!res.ok) throw await apiError(res)
}
