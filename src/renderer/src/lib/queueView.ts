import type { QueueItem } from '../../../shared/youtube/queue.ts'

export type QueueFilter = 'all' | 'pending' | 'attention' | 'done'

const RANK: Record<QueueItem['status'], number> = { uploading: 0, failed: 1, blocked: 1, queued: 2, done: 3 }

/**
 * Urutan baca antrean: yang sedang diunggah, lalu yang perlu tindakan, lalu yang menunggu
 * (giliran berikutnya di atas), lalu yang selesai (terbaru di atas).
 */
export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const r = RANK[a.status] - RANK[b.status]
    if (r !== 0) return r
    if (a.status === 'done') return b.updatedAt.localeCompare(a.updatedAt)
    return a.id - b.id
  })
}

export function matchesFilter(i: QueueItem, f: QueueFilter): boolean {
  if (f === 'pending') return i.status === 'queued' || i.status === 'uploading'
  if (f === 'attention') return i.status === 'failed' || i.status === 'blocked'
  if (f === 'done') return i.status === 'done'
  return true
}

export function filterQueue(items: QueueItem[], p: { filter: QueueFilter; channelId: string; query: string; channelNames: Record<string, string> }): QueueItem[] {
  const q = p.query.trim().toLowerCase()
  return items.filter(
    (i) =>
      matchesFilter(i, p.filter) &&
      (!p.channelId || i.channelId === p.channelId) &&
      (!q || i.title.toLowerCase().includes(q) || (p.channelNames[i.channelId] ?? '').toLowerCase().includes(q))
  )
}

/** Angka ringkasan untuk deret statistik. `today` = awal hari lokal. */
export function queueCounts(items: QueueItem[], today: Date) {
  const start = today.getTime()
  return {
    pending: items.filter((i) => i.status === 'queued').length,
    uploading: items.filter((i) => i.status === 'uploading').length,
    attention: items.filter((i) => i.status === 'failed' || i.status === 'blocked').length,
    doneToday: items.filter((i) => i.status === 'done' && new Date(i.updatedAt).getTime() >= start).length,
    done: items.filter((i) => i.status === 'done').length
  }
}
