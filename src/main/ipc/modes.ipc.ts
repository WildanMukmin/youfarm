import { app, ipcMain, shell } from 'electron'
import {
  IPC,
  type EnqueueJobRequest,
  type EnqueueJobResult,
  type ModeProgress,
  type ModeRunResult,
  type VoiceCatalog
} from '@shared/ipc-channels'
import { disclosureFor } from '@shared/contracts/modes'
import { DEFAULT_CATEGORY_ID, GEMINI_VOICES } from '@shared/modes/fakta-unik'
import { isChannelId } from '@shared/youtube/accounts'
import type { Privacy } from '@shared/youtube/metadata'
import { nextFreeSlots } from '@shared/youtube/schedule'
import { createJobRegistry, isJobId } from '../modes/jobs'
import { piper, runWithRealDeps } from '../modes/fakta-unik/runtime'
import { getUploadQueue } from '../youtube/queue'
import { handleMediaProtocol } from '../platform/media-protocol'

/** Jam tayang bawaan (waktu lokal). Pengaturan per channel menyusul. */
const DEFAULT_SLOTS = ['07:00', '12:00', '19:00']
const PRIVACY: Privacy[] = ['private', 'unlisted', 'public']

const jobs = createJobRegistry()

export function registerModesIpc(): void {
  handleMediaProtocol((jobId, kind) => {
    const rec = isJobId(jobId) ? jobs.get(jobId) : undefined
    if (!rec) return undefined
    if (kind === 'video') return rec.video.filePath
    if (kind === 'thumb') return rec.video.thumbnailPath ?? undefined
    return undefined
  })

  ipcMain.handle(IPC.modeRun, async (e, jobId: unknown, mode: unknown, options: unknown): Promise<ModeRunResult> => {
    if (!isJobId(jobId)) throw new Error('ID job tidak valid.')
    if (mode !== 'fakta-unik') throw new Error('Mode ini belum tersedia.')
    const signal = jobs.start(jobId)
    try {
      const sender = e.sender
      const result = await runWithRealDeps(
        options,
        (p) => {
          if (!sender.isDestroyed()) sender.send(IPC.modeProgress, { jobId, ...p } satisfies ModeProgress)
        },
        signal
      )
      jobs.save({ jobId, video: result.video, description: result.script.description, tags: result.script.tags })
      return {
        jobId,
        video: result.video,
        description: result.script.description,
        tags: result.script.tags,
        sentences: result.script.sentences.map((s) => s.text),
        warnings: result.warnings
      }
    } finally {
      jobs.finish(jobId)
    }
  })

  ipcMain.handle(IPC.modeCancel, (_e, jobId: unknown): boolean => (isJobId(jobId) ? jobs.cancel(jobId) : false))

  ipcMain.handle(IPC.modeVoices, (): VoiceCatalog => ({
    piper: piper().voices().map((v) => ({ name: v.name, lang: v.lang })),
    gemini: [...GEMINI_VOICES]
  }))

  // Berkas dibuka berdasarkan jobId yang dikenal main, bukan path dari renderer.
  ipcMain.handle(IPC.modeOpen, async (_e, jobId: unknown, what: unknown): Promise<void> => {
    const rec = isJobId(jobId) ? jobs.get(jobId) : undefined
    if (!rec) throw new Error('Hasil video tidak ditemukan. Buat ulang videonya.')
    if (what === 'folder') shell.showItemInFolder(rec.video.filePath)
    else if (what === 'file') {
      const err = await shell.openPath(rec.video.filePath)
      if (err) throw new Error(`Tidak bisa membuka video: ${err}`)
    } else throw new Error('Aksi tidak dikenal.')
  })

  ipcMain.handle(IPC.modeEnqueue, (_e, req: Partial<EnqueueJobRequest>): EnqueueJobResult => {
    const rec = isJobId(req?.jobId) ? jobs.get(req.jobId) : undefined
    if (!rec) throw new Error('Hasil video tidak ditemukan. Buat ulang videonya.')
    if (!isChannelId(req.channelId)) throw new Error('Pilih channel tujuan.')
    const privacy = PRIVACY.includes(req.privacy as Privacy) ? (req.privacy as Privacy) : 'private'

    const queue = getUploadQueue()
    let publishAt: string | null = null
    if (req.schedule) {
      const occupied = queue.snapshot().items.filter((i) => i.channelId === req.channelId && i.publishAt && i.status !== 'failed').map((i) => i.publishAt as string)
      publishAt = nextFreeSlots({ times: DEFAULT_SLOTS, occupied, now: new Date(), count: 1, tzOffsetMin: new Date().getTimezoneOffset() })[0] ?? null
    }

    const { video } = rec
    const hashtags = rec.tags.slice(0, 3).map((t) => `#${t.replace(/\s+/g, '')}`).join(' ')
    const queueId = queue.enqueue({
      channelId: req.channelId,
      mode: video.mode,
      template: video.template,
      filePath: video.filePath,
      thumbnailPath: video.thumbnailPath,
      playlistId: null,
      input: {
        title: video.title,
        description: [rec.description, hashtags].filter(Boolean).join('\n\n'),
        tags: rec.tags,
        categoryId: DEFAULT_CATEGORY_ID,
        defaultLanguage: video.language,
        defaultAudioLanguage: video.language,
        ...disclosureFor(video.mode, video.syntheticMedia),
        privacy,
        publishAt
      }
    })
    return { queueId, publishAt }
  })

  // Batalkan job yang masih berjalan supaya proses ffmpeg tidak tertinggal saat aplikasi ditutup.
  app.on('before-quit', () => jobs.cancelAll())
}
