import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { QueueSnapshot } from '@shared/youtube/queue'
import { errMsg } from '@/lib/errors'

const POLL_MS = 3000

interface State {
  snapshot: QueueSnapshot | null
  channelNames: Record<string, string>
}

// Satu sumber data antrean untuk seluruh aplikasi (halaman Antrean dan badge sidebar):
// polling hanya berjalan selama ada komponen yang mendengarkan.
let state: State = { snapshot: null, channelNames: {} }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function tick(): void {
  void window.youfarm?.queue.snapshot().then((snapshot) => set({ snapshot }))
}

function refreshNames(): void {
  void window.youfarm?.youtube.status().then((s) => set({ channelNames: Object.fromEntries(s.accounts.map((a) => [a.channel.id, a.channel.title])) }))
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  if (!timer && window.youfarm) {
    tick()
    refreshNames()
    timer = setInterval(tick, POLL_MS)
  }
  return () => {
    listeners.delete(l)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useQueue() {
  const s = useSyncExternalStore(subscribe, () => state)

  // Nama channel bisa berubah saat akun dihubungkan; segarkan saat halaman yang memakainya dibuka.
  useEffect(() => refreshNames(), [])

  const act = useCallback(async (fn: () => Promise<QueueSnapshot | void>, ok?: string) => {
    try {
      const r = await fn()
      if (r) set({ snapshot: r })
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }, [])

  return {
    snapshot: s.snapshot,
    channelNames: s.channelNames,
    retry: (id: number) => act(() => window.youfarm.queue.retry(id), 'Dimasukkan lagi ke antrean.'),
    remove: (id: number) => act(() => window.youfarm.queue.remove(id), 'Dihapus dari antrean.'),
    pause: () => act(() => window.youfarm.queue.pause(), 'Antrean dijeda.'),
    resume: () => act(() => window.youfarm.queue.resume(), 'Antrean dilanjutkan.'),
    openVideo: (id: number) => act(() => window.youfarm.queue.openVideo(id))
  }
}
