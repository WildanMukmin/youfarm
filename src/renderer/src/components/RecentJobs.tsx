import type { ProductionJob, ProductionStatus } from '@shared/production'

const LABEL: Record<ProductionStatus, string> = { queued: 'Antre', running: 'Dibuat', done: 'Jadi', failed: 'Gagal', cancelled: 'Dibatalkan' }
const TONE: Record<ProductionStatus, string> = {
  queued: 'text-ink-muted',
  running: 'text-crimson-hi',
  done: 'text-ok',
  failed: 'text-err',
  cancelled: 'text-ink-muted'
}

interface Props {
  jobs: ProductionJob[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Video antrean terbaru untuk satu mode. Klik salah satu untuk menontonnya di bingkai. Daftar lengkap ada di menu Antrean. */
export default function RecentJobs({ jobs, selectedId, onSelect }: Props) {
  if (jobs.length === 0) return null
  return (
    <div role="group" aria-label="Video terbaru" className="flex shrink-0 gap-2 overflow-x-auto border-t border-line px-4 py-2.5">
      {jobs.map((j) => {
        const on = j.id === selectedId
        return (
          <button
            key={j.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(j.id)}
            title={j.title ?? j.topic}
            className={`grid w-44 shrink-0 gap-0.5 rounded-sm border px-2.5 py-1.5 text-left transition-colors ${on ? 'border-crimson bg-crimson/10' : 'border-line-hi hover:border-ink-muted'}`}
          >
            <span className="truncate text-xs text-ink">{j.title ?? j.topic}</span>
            <span className={`tabular font-mono text-[11px] ${TONE[j.status]}`}>{j.status === 'running' ? `${LABEL.running} ${j.percent}%` : LABEL[j.status]}</span>
          </button>
        )
      })}
    </div>
  )
}
