import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { ProductionSnapshot } from '@shared/production'
import type { QueueSnapshot } from '@shared/youtube/queue'
import { errMsg } from '@/lib/errors'

const POLL_MS = 2000

interface State {
  snapshot: QueueSnapshot | null
  production: ProductionSnapshot | null
  channelNames: Record<string, string>
}

// Satu sumber data antrean (upload dan produksi) untuk seluruh aplikasi: halaman Antrean dan badge sidebar.
// Polling hanya berjalan selama ada komponen yang mendengarkan.
let state: State = { snapshot: null, production: null, channelNames: {} }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function tick(): void {
  const api = window.youfarm
  if (!api) return
  void api.queue.snapshot().then((snapshot) => set({ snapshot }))
  void api.production.snapshot().then((production) => set({ production }))
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

/** Segarkan segera (mis. setelah memasukkan job dari ruang kerja mode). */
export const refreshQueues = (): void => tick()

export function useQueue() {
  const s = useSyncExternalStore(subscribe, () => state)

  // Nama channel bisa berubah saat akun dihubungkan; segarkan saat halaman yang memakainya dibuka.
  useEffect(() => refreshNames(), [])

  const act = useCallback(async <T,>(fn: () => Promise<T>, apply: (r: T) => void, ok?: string) => {
    try {
      apply(await fn())
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }, [])

  const up = (snapshot: QueueSnapshot | void): void => {
    if (snapshot) set({ snapshot })
  }
  const prod = (production: ProductionSnapshot): void => set({ production })

  return {
    snapshot: s.snapshot,
    production: s.production,
    channelNames: s.channelNames,
    retry: (id: number) => act(() => window.youfarm.queue.retry(id), up, 'Dimasukkan lagi ke antrean.'),
    remove: (id: number) => act(() => window.youfarm.queue.remove(id), up, 'Dihapus dari antrean.'),
    pause: () => act(() => window.youfarm.queue.pause(), up, 'Antrean upload dijeda.'),
    resume: () => act(() => window.youfarm.queue.resume(), up, 'Antrean upload dilanjutkan.'),
    openVideo: (id: number) => act(() => window.youfarm.queue.openVideo(id), () => undefined),
    prod: {
      cancel: (id: number) => act(() => window.youfarm.production.cancel(id), prod, 'Dibatalkan.'),
      retry: (id: number) => act(() => window.youfarm.production.retry(id), prod, 'Dimasukkan lagi ke antrean produksi.'),
      remove: (id: number) => act(() => window.youfarm.production.remove(id), prod, 'Video dihapus.'),
      pause: () => act(() => window.youfarm.production.pause(), prod, 'Antrean produksi dijeda.'),
      resume: () => act(() => window.youfarm.production.resume(), prod, 'Antrean produksi dilanjutkan.'),
      open: (id: number, what: 'file' | 'folder') => act(() => window.youfarm.production.open(id, what), () => undefined)
    }
  }
}
