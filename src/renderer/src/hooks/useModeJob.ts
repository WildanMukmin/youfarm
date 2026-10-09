import { useCallback, useSyncExternalStore } from 'react'
import type { ModeProgress, ModeRunResult } from '@shared/ipc-channels'
import { errMsg } from '@/lib/errors'

export type JobState =
  | { phase: 'idle' }
  | { phase: 'running'; jobId: string; progress: ModeProgress | null }
  | { phase: 'done'; result: ModeRunResult }
  | { phase: 'error'; message: string; cancelled: boolean }

const IDLE: JobState = { phase: 'idle' }

// Status job disimpan di luar komponen: pindah menu tidak boleh membuat job yang masih berjalan "hilang" dari UI.
const states = new Map<string, JobState>()
const jobMode = new Map<string, string>()
const listeners = new Set<() => void>()
let attached = false

function setState(mode: string, s: JobState): void {
  states.set(mode, s)
  listeners.forEach((l) => l())
}

function attach(): void {
  if (attached || !window.youfarm) return
  attached = true
  window.youfarm.modes.onProgress((p) => {
    const mode = jobMode.get(p.jobId)
    const s = mode ? states.get(mode) : undefined
    if (mode && s?.phase === 'running' && s.jobId === p.jobId) setState(mode, { ...s, progress: p })
  })
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Menjalankan satu job mode produksi: progres, pembatalan, hasil. Mode apa pun memakai hook yang sama. */
export function useModeJob(mode: string) {
  attach()
  const state = useSyncExternalStore(subscribe, () => states.get(mode) ?? IDLE)

  const run = useCallback(
    async (options: unknown) => {
      const jobId = crypto.randomUUID()
      jobMode.set(jobId, mode)
      setState(mode, { phase: 'running', jobId, progress: null })
      try {
        const result = await window.youfarm.modes.run(jobId, mode, options)
        setState(mode, { phase: 'done', result })
      } catch (e) {
        const message = errMsg(e, 'Gagal membuat video.')
        setState(mode, { phase: 'error', message, cancelled: /dibatalkan/i.test(message) })
      } finally {
        jobMode.delete(jobId)
      }
    },
    [mode]
  )

  const cancel = useCallback(() => {
    const s = states.get(mode)
    if (s?.phase === 'running') void window.youfarm.modes.cancel(s.jobId)
  }, [mode])

  const reset = useCallback(() => setState(mode, IDLE), [mode])

  return { state, run, cancel, reset }
}
