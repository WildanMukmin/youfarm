import { Check } from 'lucide-react'
import type { JobStage as Stage } from '@shared/ipc-channels'
import { mediaUrl } from '@shared/media'
import type { JobState } from '@/hooks/useModeJob'
import Button from '@/ui/Button'
import Notice from '@/ui/Notice'
import ProgressBar from '@/ui/ProgressBar'

const STEPS: { id: Exclude<Stage, 'done'>; label: string }[] = [
  { id: 'script', label: 'Naskah' },
  { id: 'voice', label: 'Suara' },
  { id: 'visual', label: 'Footage' },
  { id: 'render', label: 'Render' },
  { id: 'thumbnail', label: 'Thumbnail' }
]

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

interface Props {
  state: JobState
  onCancel: () => void
  onReset: () => void
  onOpen: (what: 'file' | 'folder') => void
  /** Teks di bingkai kosong sebelum ada video. */
  idleHint: string
}

function Stepper({ state }: { state: JobState }) {
  const current = state.phase === 'running' ? STEPS.findIndex((s) => s.id === state.progress?.stage) : -1
  return (
    <ol className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2.5">
      {STEPS.map((s, i) => {
        const done = state.phase === 'done' || (state.phase === 'running' && (current > i || state.progress?.stage === 'done'))
        const active = state.phase === 'running' && current === i
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={
                'grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ' +
                (done ? 'border-ok bg-ok/15 text-ok' : active ? 'border-crimson text-crimson-hi shadow-glow' : 'border-line-hi text-ink-muted')
              }
            >
              {done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`truncate text-xs ${active ? 'text-ink' : 'text-ink-muted'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="h-px min-w-3 flex-1 bg-line-hi" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Area tengah ruang kerja mode produksi: bingkai 9:16 untuk pratinjau, progres, atau hasil. */
export default function JobStage({ state, onCancel, onReset, onOpen, idleHint }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Stepper state={state} />

      <div className="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto p-6">
        <div className="relative aspect-[9/16] h-full max-h-[720px] min-h-[320px] shrink-0 overflow-hidden rounded-md border border-line-hi bg-bg">
          {state.phase === 'done' ? (
            <video
              key={state.result.jobId}
              className="h-full w-full bg-black object-contain"
              src={mediaUrl(state.result.jobId, 'video')}
              poster={state.result.video.thumbnailPath ? mediaUrl(state.result.jobId, 'thumb') : undefined}
              controls
            />
          ) : state.phase === 'running' ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="font-mono text-4xl font-bold text-crimson-hi">{state.progress?.percent ?? 0}%</span>
              <div className="w-full">
                <ProgressBar value={state.progress?.percent ?? 0} label="Kemajuan pembuatan video" />
              </div>
              <p className="text-sm text-ink-muted" aria-live="polite">
                {state.progress?.message ?? 'Menyiapkan…'}
              </p>
              <Button variant="ghost" onClick={onCancel}>
                Batal
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 border-2 border-dashed border-line p-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">9:16 · 1080×1920</span>
              <p className="text-sm text-ink-muted">{idleHint}</p>
            </div>
          )}
        </div>

        {state.phase === 'error' && (
          <div className="w-72 shrink-0">
            <Notice tone={state.cancelled ? 'info' : 'error'} title={state.cancelled ? 'Dibatalkan' : 'Gagal membuat video'}>
              {state.message}
            </Notice>
          </div>
        )}
      </div>

      {state.phase === 'done' && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <div className="whitespace-nowrap font-mono text-xs text-ink-muted">
            <span className="text-ink">{mmss(state.result.video.durationSec)}</span> · {state.result.video.aspect} · {state.result.video.language.toUpperCase()}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onOpen('file')}>
              Buka di pemutar
            </Button>
            <Button size="sm" variant="ghost" title={state.result.video.filePath} onClick={() => onOpen('folder')}>
              Tampilkan di folder
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset}>
              Buat baru
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
