import { app } from 'electron'
import { getDb, getKv, setKv } from '../platform/db'
import { getAccountService, getEndpoints } from './account'
import { createUploadQueue, type UploadQueue } from './upload-queue'

let queue: UploadQueue | null = null

const PAUSED_KEY = 'upload-queue-paused'

/** Antrean upload tunggal. Mode produksi memanggil `enqueue` dari main, bukan dari renderer. */
export function getUploadQueue(): UploadQueue {
  if (!queue) {
    queue = createUploadQueue({
      db: getDb(),
      apiBase: getEndpoints().api,
      accessToken: (channelId, signal) => getAccountService().accessToken(channelId, signal)
    })
    app.on('before-quit', () => queue?.stop())
  }
  return queue
}

/** Jeda antar upload (detik). Di build pengembangan bisa dipersingkat lewat YOUFARM_QUEUE_GAP="min,max". */
export function queueLoopOptions(): { minGapSec?: number; maxGapSec?: number; idleMs?: number } {
  const raw = app.isPackaged ? undefined : process.env['YOUFARM_QUEUE_GAP']
  if (!raw) return {}
  const [min, max] = raw.split(',').map(Number)
  return Number.isFinite(min) && Number.isFinite(max) ? { minGapSec: min, maxGapSec: max, idleMs: 1000 } : {}
}

export const isQueuePaused = (): boolean => getKv(PAUSED_KEY) === '1'

/** Dipanggil saat aplikasi siap: jalan kecuali pengguna menjedanya sebelum aplikasi ditutup. */
export function startUploadQueue(): void {
  if (!isQueuePaused()) getUploadQueue().start(queueLoopOptions())
}

/** Jeda bertahan setelah aplikasi ditutup. Upload yang sedang berjalan dibatalkan dan kembali antre. */
export function pauseUploadQueue(): void {
  setKv(PAUSED_KEY, '1')
  getUploadQueue().stop()
}

export function resumeUploadQueue(): void {
  setKv(PAUSED_KEY, '0')
  getUploadQueue().start(queueLoopOptions())
}
