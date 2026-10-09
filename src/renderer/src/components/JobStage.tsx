import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { mediaUrl } from '@shared/media'
import type { ProductionDetail, ProductionJob } from '@shared/production'
import { useElementSize } from '@/hooks/useFitRows'
import Button from '@/ui/Button'
import Notice from '@/ui/Notice'
import ProgressBar from '@/ui/ProgressBar'

const STEPS: { id: string; label: string }[] = [
  { id: 'script', label: 'Naskah' },
  { id: 'voice', label: 'Suara' },
  { id: 'visual', label: 'Footage' },
  { id: 'render', label: 'Render' },
  { id: 'thumbnail', label: 'Thumbnail' }
]

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

interface Props {
  /** Video yang ditampilkan; null bila belum ada. */
  job: ProductionJob | null
  detail: ProductionDetail | null
  /** Antrean produksi sedang dijeda: video yang menunggu tidak akan mulai. */
  paused: boolean
  onCancel: (id: number) => void
  onRetry: (id: number) => void
  onResume: () => void
  onOpen: (id: number, what: 'file' | 'folder') => void
  /** Teks di bingkai kosong sebelum ada video. */
  idleHint: string
  /** Isi bingkai sebelum ada video atau saat menyunting gaya (mis. pratinjau caption). */
  idle?: ReactNode
  /** Tampilkan `idle` walau ada video. */
  forceIdle?: boolean
}

/** Saat sempit hanya label langkah aktif yang ditampilkan; sisanya cukup nomor. */
function Stepper({ job, compact }: { job: ProductionJob | null; compact: boolean }) {
  const current = job?.status === 'running' ? STEPS.findIndex((s) => s.id === job.stage) : -1
  return (
    <ol className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2.5">
      {STEPS.map((s, i) => {
        const done = job?.status === 'done' || (job?.status === 'running' && (current > i || job.stage === 'done'))
        const active = job?.status === 'running' && current === i
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
            {(!compact || active) && <span className={`truncate text-xs ${active ? 'text-ink' : 'text-ink-muted'}`}>{s.label}</span>}
            {i < STEPS.length - 1 && <span className="h-px min-w-3 flex-1 bg-line-hi" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Area tengah ruang kerja mode produksi: bingkai 9:16 untuk pratinjau, progres, atau hasil satu video antrean. */
export default function JobStage({ job, detail, paused, onCancel, onRetry, onResume, onOpen, idleHint, idle, forceIdle }: Props) {
  const area = useElementSize()
  const showIdle = forceIdle || !job
  const problem = !showIdle && job && (job.status === 'failed' || job.status === 'cancelled')

  return (
    <div ref={area.ref} className="flex min-h-0 flex-1 flex-col">
      <Stepper job={showIdle ? null : job} compact={area.width > 0 && area.width < 560} />

      <div className="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-hidden p-6" style={{ containerType: 'size' }}>
        <div
          className="relative aspect-[9/16] shrink-0 overflow-hidden rounded-md border border-line-hi bg-bg"
          style={{ height: problem ? 'min(100cqh, 720px, calc((100cqw - 312px) * 16 / 9))' : 'min(100cqh, 720px, calc(100cqw * 16 / 9))' }}
        >
          {showIdle ? (
            (idle ?? (
              <div className="flex h-full flex-col items-center justify-center gap-3 border-2 border-dashed border-line p-6 text-center">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">9:16 · 1080×1920</span>
                <p className="text-sm text-ink-muted">{idleHint}</p>
              </div>
            ))
          ) : job.status === 'done' ? (
            <video
              key={job.id}
              className="h-full w-full bg-black object-contain"
              src={mediaUrl(job.id, 'video')}
              poster={detail?.video.hasThumbnail ? mediaUrl(job.id, 'thumb') : undefined}
              controls
            />
          ) : job.status === 'running' ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="font-mono text-4xl font-bold text-crimson-hi">{job.percent}%</span>
              <div className="w-full">
                <ProgressBar value={job.percent} label="Kemajuan pembuatan video" />
              </div>
              <p className="text-sm text-ink-muted" aria-live="polite">
                {job.message ?? 'Menyiapkan…'}
              </p>
              <Button variant="ghost" onClick={() => onCancel(job.id)}>
                Batal
              </Button>
            </div>
          ) : job.status === 'queued' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">{paused ? 'Antrean dijeda' : 'Menunggu giliran'}</span>
              <p className="text-sm text-ink-muted">{paused ? 'Video ini mulai dibuat setelah antrean produksi dilanjutkan.' : 'Satu video dibuat sekali jalan. Yang ini mulai setelah video di depannya selesai.'}</p>
              {paused && <Button onClick={onResume}>Lanjutkan antrean</Button>}
              <Button variant="ghost" onClick={() => onCancel(job.id)}>
                Batal
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 border-2 border-dashed border-line p-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">{job.status === 'failed' ? 'Gagal' : 'Dibatalkan'}</span>
            </div>
          )}
        </div>

        {problem && (
          <div className="grid w-72 shrink-0 gap-3">
            <Notice tone={job.status === 'cancelled' ? 'info' : 'error'} title={job.status === 'cancelled' ? 'Dibatalkan' : 'Gagal membuat video'}>
              {job.errorMessage ?? 'Video ini tidak selesai dibuat.'}
            </Notice>
            <div>
              <Button variant="ghost" onClick={() => onRetry(job.id)}>
                Coba lagi
              </Button>
            </div>
          </div>
        )}
      </div>

      {!showIdle && job && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <div className="min-w-0 whitespace-nowrap font-mono text-xs text-ink-muted">
            <span className="block truncate text-ink" title={job.title ?? job.topic}>
              {job.title ?? job.topic}
            </span>
            {job.status === 'done' && detail && (
              <span>
                {mmss(job.durationSec ?? 0)} · {detail.video.aspect} · {detail.video.language.toUpperCase()}
              </span>
            )}
          </div>
          {job.status === 'done' && (
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => onOpen(job.id, 'file')}>
                Buka di pemutar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpen(job.id, 'folder')}>
                Tampilkan di folder
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
