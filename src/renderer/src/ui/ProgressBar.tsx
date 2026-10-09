type Tone = 'crimson' | 'amber' | 'ok'

const TONES: Record<Tone, string> = {
  crimson: 'bg-crimson shadow-[0_0_10px_var(--crimson)]',
  amber: 'bg-amber shadow-[0_0_10px_var(--amber)]',
  ok: 'bg-ok'
}

interface Props {
  /** 0 sampai 100. */
  value: number
  tone?: Tone
  label: string
}

export default function ProgressBar({ value, tone = 'crimson', label }: Props) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className="h-1.5 overflow-hidden rounded-full border border-line bg-panel-2"
    >
      <div className={`h-full ${TONES[tone]}`} style={{ width: `${v}%` }} />
    </div>
  )
}
