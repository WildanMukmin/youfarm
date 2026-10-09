import type { QueueItem } from '../../../shared/youtube/queue.ts'
import { nextFreeSlots } from '../../../shared/youtube/schedule.ts'

/** Jadwal tayang yang sudah terpakai di satu channel (sama dengan aturan di main saat enqueue). */
export function occupiedSlots(items: QueueItem[], channelId: string): string[] {
  return items.filter((i) => i.channelId === channelId && i.publishAt && i.status !== 'failed').map((i) => i.publishAt as string)
}

/** Slot kosong berikutnya untuk satu channel, memakai zona waktu komputer ini. */
export function upcomingSlots(times: string[], items: QueueItem[], channelId: string, count: number, now = new Date()): string[] {
  return nextFreeSlots({ times, occupied: occupiedSlots(items, channelId), now, count, tzOffsetMin: now.getTimezoneOffset() })
}

/** Preset jam tayang untuk editor. */
export const SLOT_PRESETS: { label: string; times: string[] }[] = [
  { label: '1× sehari', times: ['19:00'] },
  { label: '2× sehari', times: ['12:00', '19:00'] },
  { label: '3× sehari', times: ['07:00', '12:00', '19:00'] }
]

/** Jam baru untuk tombol "Tambah": satu jam setelah slot terakhir, dibungkus 24 jam, tidak bentrok. */
export function suggestSlot(times: string[]): string {
  const taken = new Set(times)
  const last = [...times].sort().at(-1) ?? '18:00'
  let h = (Number(last.slice(0, 2)) + 1) % 24
  for (let i = 0; i < 24; i++) {
    const t = `${String(h).padStart(2, '0')}:00`
    if (!taken.has(t)) return t
    h = (h + 1) % 24
  }
  return '00:30'
}
