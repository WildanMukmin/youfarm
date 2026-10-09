import type { ProductionJob } from '../../../shared/production.ts'

export type ProductionFilter = 'all' | 'active' | 'failed' | 'done'

const RANK: Record<ProductionJob['status'], number> = { running: 0, failed: 1, queued: 2, done: 3, cancelled: 4 }

/** Yang sedang dibuat, yang gagal, giliran berikutnya, lalu yang selesai/dibatalkan (terbaru dulu). */
export function sortProduction(items: ProductionJob[]): ProductionJob[] {
  return [...items].sort((a, b) => {
    const r = RANK[a.status] - RANK[b.status]
    if (r !== 0) return r
    if (a.status === 'queued') return a.id - b.id
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export function matchesProduction(j: ProductionJob, f: ProductionFilter): boolean {
  if (f === 'active') return j.status === 'queued' || j.status === 'running'
  if (f === 'failed') return j.status === 'failed'
  if (f === 'done') return j.status === 'done'
  return true
}

export function filterProduction(items: ProductionJob[], filter: ProductionFilter, query: string): ProductionJob[] {
  const q = query.trim().toLowerCase()
  return items.filter((j) => matchesProduction(j, filter) && (!q || j.topic.toLowerCase().includes(q) || (j.title ?? '').toLowerCase().includes(q)))
}

export function productionCounts(items: ProductionJob[], today: Date) {
  const start = today.getTime()
  const queued = items.filter((j) => j.status === 'queued').length
  const running = items.filter((j) => j.status === 'running').length
  return {
    queued,
    running,
    active: queued + running,
    failed: items.filter((j) => j.status === 'failed').length,
    doneToday: items.filter((j) => j.status === 'done' && j.finishedAt && new Date(j.finishedAt).getTime() >= start).length,
    done: items.filter((j) => j.status === 'done').length
  }
}
