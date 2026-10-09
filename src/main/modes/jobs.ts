import type { RenderedVideo } from '../../shared/contracts/modes.ts'

/** Hasil satu job produksi yang disimpan di main supaya renderer tidak perlu (dan tidak boleh) mengirim path berkas. */
export interface JobRecord {
  jobId: string
  video: RenderedVideo
  description: string
  tags: string[]
}

const MAX_RESULTS = 50

/** Registri job: pembatalan per job dan hasil yang sudah selesai. Mode tidak saling mengganggu. */
export function createJobRegistry() {
  const running = new Map<string, AbortController>()
  const results = new Map<string, JobRecord>()

  return {
    /** Mulai job baru. Melempar bila id sudah berjalan. */
    start(jobId: string): AbortSignal {
      if (running.has(jobId)) throw new Error('Job ini sudah berjalan.')
      const ac = new AbortController()
      running.set(jobId, ac)
      return ac.signal
    },
    finish(jobId: string): void {
      running.delete(jobId)
    },
    cancel(jobId: string): boolean {
      const ac = running.get(jobId)
      ac?.abort()
      return Boolean(ac)
    },
    cancelAll(): void {
      for (const ac of running.values()) ac.abort()
    },
    isRunning: (jobId: string): boolean => running.has(jobId),
    save(record: JobRecord): void {
      results.set(record.jobId, record)
      // Batasi memori: buang hasil paling lama.
      while (results.size > MAX_RESULTS) results.delete(results.keys().next().value as string)
    },
    get: (jobId: string): JobRecord | undefined => results.get(jobId)
  }
}

export type JobRegistry = ReturnType<typeof createJobRegistry>

export const isJobId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v)
