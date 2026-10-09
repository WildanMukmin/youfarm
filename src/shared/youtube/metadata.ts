/** Membangun body `videos.insert` yang valid. Murni, tanpa jaringan. */

export const CATEGORIES = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' }
] as const

export type Privacy = 'private' | 'unlisted' | 'public'

export const TITLE_MAX = 100
export const DESCRIPTION_MAX_BYTES = 5000
export const TAGS_MAX_CHARS = 480
/** Batas minimal waktu tayang terjadwal dari sekarang. */
export const MIN_PUBLISH_LEAD_MIN = 15

export interface UploadInput {
  title: string
  description: string
  tags: string[]
  categoryId: string
  defaultLanguage?: string
  defaultAudioLanguage?: string
  madeForKids: boolean
  containsSyntheticMedia: boolean
  privacy: Privacy
  /** ISO 8601. Bila diisi, video diunggah private lalu tayang otomatis. */
  publishAt?: string | null
}

export interface UploadBody {
  snippet: {
    title: string
    description: string
    tags: string[]
    categoryId: string
    defaultLanguage?: string
    defaultAudioLanguage?: string
  }
  status: {
    privacyStatus: Privacy
    publishAt?: string
    selfDeclaredMadeForKids: boolean
    containsSyntheticMedia: boolean
  }
}

/** YouTube menolak < dan > di judul, deskripsi, dan tag. */
const stripAngle = (s: string): string => s.replace(/[<>]/g, '')

export function sanitizeTitle(s: string): string {
  return [...stripAngle(s).replace(/\s+/g, ' ').trim()].slice(0, TITLE_MAX).join('').trim()
}

export function sanitizeDescription(s: string): string {
  const clean = stripAngle(s).replace(/\r\n/g, '\n').trim()
  const enc = new TextEncoder()
  if (enc.encode(clean).length <= DESCRIPTION_MAX_BYTES) return clean
  let out = ''
  let bytes = 0
  for (const ch of clean) {
    const n = enc.encode(ch).length
    if (bytes + n > DESCRIPTION_MAX_BYTES) break
    out += ch
    bytes += n
  }
  return out.trimEnd()
}

/** Buang duplikat dan tag kosong, lalu potong sampai total karakter aman (batas YouTube 500). */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let total = 0
  for (const raw of tags) {
    const t = stripAngle(raw).replace(/\s+/g, ' ').replace(/^#/, '').trim()
    const key = t.toLowerCase()
    if (!t || t.length > 100 || seen.has(key)) continue
    // Tag berspasi dihitung dengan tanda kutip, ditambah pemisah.
    const cost = t.length + (t.includes(' ') ? 2 : 0) + 1
    if (total + cost > TAGS_MAX_CHARS) break
    seen.add(key)
    out.push(t)
    total += cost
  }
  return out
}

export function validatePublishAt(iso: string, now: Date): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) throw new Error('Waktu tayang tidak valid.')
  if (t.getTime() < now.getTime() + MIN_PUBLISH_LEAD_MIN * 60_000) {
    throw new Error(`Waktu tayang minimal ${MIN_PUBLISH_LEAD_MIN} menit dari sekarang.`)
  }
  return t.toISOString()
}

export function buildUploadBody(i: UploadInput, now: Date = new Date()): UploadBody {
  const title = sanitizeTitle(i.title)
  if (!title) throw new Error('Judul video kosong.')
  if (!CATEGORIES.some((c) => c.id === i.categoryId)) throw new Error('Kategori tidak dikenal.')

  const publishAt = i.publishAt ? validatePublishAt(i.publishAt, now) : undefined
  return {
    snippet: {
      title,
      description: sanitizeDescription(i.description),
      tags: normalizeTags(i.tags),
      categoryId: i.categoryId,
      ...(i.defaultLanguage ? { defaultLanguage: i.defaultLanguage } : {}),
      ...(i.defaultAudioLanguage ? { defaultAudioLanguage: i.defaultAudioLanguage } : {})
    },
    status: {
      // Video terjadwal wajib private sampai waktunya tayang.
      privacyStatus: publishAt ? 'private' : i.privacy,
      ...(publishAt ? { publishAt } : {}),
      selfDeclaredMadeForKids: i.madeForKids,
      containsSyntheticMedia: i.containsSyntheticMedia
    }
  }
}
