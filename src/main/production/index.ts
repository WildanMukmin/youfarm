import { app } from 'electron'
import { validateOptions, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { getDb, getKv, setKv } from '../platform/db'
import { runWithRealDeps } from '../modes/fakta-unik/runtime'
import { enqueueRendered } from '../modes/publish'
import { createProductionQueue, type ProductionQueue } from './queue-core'

const PAUSED_KEY = 'production-queue-paused'

let queue: ProductionQueue | null = null

export function getProductionQueue(): ProductionQueue {
  if (!queue) {
    const q = createProductionQueue({
      db: getDb(),
      validate: (mode, raw) => {
        if (mode !== 'fakta-unik') throw new Error('Mode ini belum bisa diantrekan.')
        const o = validateOptions(raw)
        return { options: o, topic: o.topic }
      },
      runners: {
        'fakta-unik': async (raw, onProgress, signal) => {
          const o = raw as FaktaUnikOptions
          // Judul video yang sudah pernah jadi masuk daftar "avoid", supaya AI tidak mengulang fakta yang sama.
          const avoid = [...new Set([...o.avoid, ...q.recentTitles('fakta-unik')])].slice(0, 50)
          const r = await runWithRealDeps({ ...o, avoid }, onProgress, signal)
          return { video: r.video, description: r.script.description, tags: r.script.tags, warnings: r.warnings }
        }
      },
      publish: (res, plan) => enqueueRendered(res, plan).queueId
    })
    queue = q
    app.on('before-quit', () => queue?.stop())
  }
  return queue
}

export const isProductionPaused = (): boolean => getKv(PAUSED_KEY) === '1'

export function startProductionQueue(): void {
  if (!isProductionPaused()) getProductionQueue().start()
}

/** Jeda bertahan setelah aplikasi ditutup. Video yang sedang dibuat dihentikan dan kembali antre. */
export function pauseProductionQueue(): void {
  setKv(PAUSED_KEY, '1')
  getProductionQueue().stop()
}

export function resumeProductionQueue(): void {
  setKv(PAUSED_KEY, '0')
  getProductionQueue().start()
}
