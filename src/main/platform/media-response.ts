import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav'
}

/** "bytes=100-199" atau "bytes=100-" -> rentang inklusif, atau null bila tidak valid. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start: number
  let end: number
  if (m[1] === '') {
    // Akhiran: N byte terakhir.
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return start <= end && start < size ? { start, end } : null
}

/** Response untuk berkas lokal dengan dukungan Range (dibutuhkan pemutar video untuk seek). */
export async function fileResponse(file: string, rangeHeader: string | null): Promise<Response> {
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return new Response('Tidak ditemukan', { status: 404 })
  }
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }

  if (rangeHeader) {
    const r = parseRange(rangeHeader, size)
    if (!r) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } })
    const body = Readable.toWeb(createReadStream(file, { start: r.start, end: r.end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: { ...base, 'Content-Range': `bytes ${r.start}-${r.end}/${size}`, 'Content-Length': String(r.end - r.start + 1) }
    })
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new Response(body, { status: 200, headers: { ...base, 'Content-Length': String(size) } })
}
