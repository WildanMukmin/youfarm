import { disclosureFor, type ProductionModeId, type RenderedVideo } from '@shared/contracts/modes'
import { DEFAULT_CATEGORY_ID as FAKTA_CATEGORY } from '@shared/modes/fakta-unik'
import { isChannelId } from '@shared/youtube/accounts'
import { composeDescription, type Privacy } from '@shared/youtube/metadata'
import { nextFreeSlots } from '@shared/youtube/schedule'
import { getAccountService } from '../youtube/account'
import { getUploadQueue } from '../youtube/queue'

const PRIVACY: Privacy[] = ['private', 'unlisted', 'public']

/** Kategori YouTube bawaan tiap mode; mode yang belum terdaftar memakai Entertainment (24). */
const CATEGORY: Partial<Record<ProductionModeId, string>> = { 'fakta-unik': FAKTA_CATEGORY }

export interface RenderedRecord {
  video: RenderedVideo
  description: string
  tags: string[]
}

export interface PublishRequest {
  channelId: unknown
  privacy: unknown
  schedule: unknown
  /** Suntingan pengguna. Yang tidak diisi memakai isi bawaan video. */
  title?: unknown
  description?: unknown
  tags?: unknown
  /** Berkas thumbnail pengganti yang sudah divalidasi main. */
  thumbnailPath?: string | null
}

/**
 * Masukkan video hasil mode ke antrean upload. Dipakai panel Publikasi (video tunggal) dan antrean
 * produksi (otomatis setelah jadi). Jadwal memakai jam tayang channel tujuan.
 */
export function enqueueRendered(rec: RenderedRecord, req: PublishRequest): { queueId: number; publishAt: string | null } {
  if (!isChannelId(req.channelId)) throw new Error('Pilih channel tujuan.')
  const channelId = req.channelId
  const account = getAccountService().status().accounts.find((a) => a.channel.id === channelId)
  if (!account) throw new Error('Channel tujuan sudah tidak terhubung. Pilih channel lain di menu Akun.')
  const privacy = PRIVACY.includes(req.privacy as Privacy) ? (req.privacy as Privacy) : 'public'

  const queue = getUploadQueue()
  let publishAt: string | null = null
  if (req.schedule) {
    if (account.slots.length === 0) throw new Error('Channel ini belum punya jam tayang. Atur di menu Akun.')
    const occupied = queue.snapshot().items.filter((i) => i.channelId === channelId && i.publishAt && i.status !== 'failed').map((i) => i.publishAt as string)
    publishAt = nextFreeSlots({ times: account.slots, occupied, now: new Date(), count: 1, tzOffsetMin: new Date().getTimezoneOffset() })[0] ?? null
  }

  const { video } = rec
  const text = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback)
  const tags = Array.isArray(req.tags) ? req.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : rec.tags
  const queueId = queue.enqueue({
    channelId,
    mode: video.mode,
    template: video.template,
    filePath: video.filePath,
    thumbnailPath: req.thumbnailPath ?? video.thumbnailPath,
    playlistId: null,
    input: {
      title: text(req.title, video.title),
      description: text(req.description, composeDescription({ description: rec.description, credits: video.credits, tags })),
      tags,
      categoryId: CATEGORY[video.mode] ?? '24',
      defaultLanguage: video.language,
      defaultAudioLanguage: video.language,
      ...disclosureFor(video.mode, video.syntheticMedia),
      privacy,
      publishAt
    }
  })
  return { queueId, publishAt }
}
