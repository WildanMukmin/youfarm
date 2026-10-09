import { app } from 'electron'
import { getDb } from '../platform/db'
import { getAccountService, getEndpoints } from './account'
import { createUploadQueue, type UploadQueue } from './upload-queue'

let queue: UploadQueue | null = null

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
