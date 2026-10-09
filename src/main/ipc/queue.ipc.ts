import { app, ipcMain, shell } from 'electron'
import { MODE_IDS } from '@shared/contracts/modes'
import { IPC, type QueueSnapshot } from '@shared/ipc-channels'
import type { EnqueueRequest } from '@shared/youtube/queue'
import { getUploadQueue, pauseUploadQueue, resumeUploadQueue } from '../youtube/queue'

function itemId(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new Error('ID item tidak valid.')
  return v
}

export function registerQueueIpc(): void {
  const q = getUploadQueue

  ipcMain.handle(IPC.queueSnapshot, (): QueueSnapshot => q().snapshot())
  ipcMain.handle(IPC.queueRetry, (_e, id: unknown): QueueSnapshot => (q().retry(itemId(id)), q().snapshot()))
  ipcMain.handle(IPC.queueRemove, (_e, id: unknown): QueueSnapshot => (q().remove(itemId(id)), q().snapshot()))
  ipcMain.handle(IPC.queueCancelCurrent, (): void => q().cancelCurrent())
  ipcMain.handle(IPC.queuePause, (): QueueSnapshot => (pauseUploadQueue(), q().snapshot()))
  ipcMain.handle(IPC.queueResume, (): QueueSnapshot => (resumeUploadQueue(), q().snapshot()))

  // URL dibangun di main dari videoId yang tersimpan; renderer hanya mengirim id item antrean.
  ipcMain.handle(IPC.queueOpenVideo, async (_e, id: unknown): Promise<void> => {
    const item = q().snapshot().items.find((i) => i.id === itemId(id))
    if (!item?.videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(item.videoId)) throw new Error('Video ini belum ada di YouTube.')
    await shell.openExternal(`https://studio.youtube.com/video/${item.videoId}/edit`)
  })

  // Renderer tidak boleh memasukkan berkas sembarang ke antrean (bisa dipakai membawa berkas lokal ke YouTube).
  // Hanya untuk pengujian di build pengembangan; mode produksi memanggil enqueue langsung dari main.
  if (!app.isPackaged && process.env['YOUFARM_DEV_ENQUEUE']) {
    ipcMain.handle('queue:dev-enqueue', (_e, req: EnqueueRequest): number => {
      if (!MODE_IDS.includes(req.mode)) throw new Error('Mode tidak valid.')
      return q().enqueue(req)
    })
  }
}
