import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { QueueSnapshot } from '@shared/youtube/queue'
import { errMsg } from '@/lib/errors'

const POLL_MS = 3000

/** Snapshot antrean upload, disegarkan berkala selama halaman terbuka. Nama channel diambil sekali. */
export function useQueue() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [channelNames, setChannelNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const api = window.youfarm
    if (!api) return
    let alive = true
    const tick = (): void => void api.queue.snapshot().then((s) => alive && setSnapshot(s))
    tick()
    const t = setInterval(tick, POLL_MS)
    void api.youtube.status().then((s) => alive && setChannelNames(Object.fromEntries(s.accounts.map((a) => [a.channel.id, a.channel.title]))))
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const act = useCallback(async (fn: () => Promise<QueueSnapshot>) => {
    try {
      setSnapshot(await fn())
    } catch (e) {
      toast.error(errMsg(e))
    }
  }, [])

  return {
    snapshot,
    channelNames,
    retry: (id: number) => act(() => window.youfarm.queue.retry(id)),
    remove: (id: number) => act(() => window.youfarm.queue.remove(id))
  }
}
