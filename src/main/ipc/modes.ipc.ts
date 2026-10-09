import { app, ipcMain, shell } from 'electron'
import {
  IPC,
  type EnqueueJobRequest,
  type EnqueueJobResult,
  type ModeProgress,
  type ModeRunResult,
  type VoiceCatalog
} from '@shared/ipc-channels'
import { GEMINI_VOICES } from '@shared/modes/fakta-unik'
import { createJobRegistry, isJobId } from '../modes/jobs'
import { piper, runWithRealDeps } from '../modes/fakta-unik/runtime'
import { handleMediaProtocol } from '../platform/media-protocol'
import { enqueueRendered } from '../modes/publish'

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
    return enqueueRendered(rec, { channelId: req.channelId, privacy: req.privacy, schedule: req.schedule })
  })

  // Batalkan job yang masih berjalan supaya proses ffmpeg tidak tertinggal saat aplikasi ditutup.
  app.on('before-quit', () => jobs.cancelAll())
}
