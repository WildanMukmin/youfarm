import { disclosureFor, type ProductionModeId, type RenderedVideo } from '@shared/contracts/modes'
import { DEFAULT_CATEGORY_ID as FAKTA_CATEGORY } from '@shared/modes/fakta-unik'
import { isChannelId } from '@shared/youtube/accounts'
import type { Privacy } from '@shared/youtube/metadata'
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
  const privacy = PRIVACY.includes(req.privacy as Privacy) ? (req.privacy as Privacy) : 'private'

  const queue = getUploadQueue()
  let publishAt: string | null = null
  if (req.schedule) {
    if (account.slots.length === 0) throw new Error('Channel ini belum punya jam tayang. Atur di menu Akun.')
    const occupied = queue.snapshot().items.filter((i) => i.channelId === channelId && i.publishAt && i.status !== 'failed').map((i) => i.publishAt as string)
    publishAt = nextFreeSlots({ times: account.slots, occupied, now: new Date(), count: 1, tzOffsetMin: new Date().getTimezoneOffset() })[0] ?? null
  }

  const { video } = rec
  const hashtags = rec.tags.slice(0, 3).map((t) => `#${t.replace(/\s+/g, '')}`).join(' ')
  const queueId = queue.enqueue({
    channelId,
    mode: video.mode,
    template: video.template,
    filePath: video.filePath,
    thumbnailPath: video.thumbnailPath,
    playlistId: null,
    input: {
      title: video.title,
      description: [rec.description, hashtags].filter(Boolean).join('\n\n'),
      tags: rec.tags,
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
