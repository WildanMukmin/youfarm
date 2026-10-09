import { useId, type KeyboardEvent } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  /** Ditampilkan sebagai tooltip. */
  title?: string
}

interface Props<T extends string> {
  label: string
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  disabled?: boolean
}

/** Pilihan ringkas satu baris (pengganti radio kartu di panel sempit). Panah kiri/kanan berpindah pilihan. */
export default function Segmented<T extends string>({ label, value, options, onChange, disabled }: Props<T>) {
  const id = useId()
  const enabled = options.filter((o) => !o.disabled)

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = enabled.findIndex((o) => o.value === value)
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : enabled.length - 1)) % enabled.length]
    if (next) onChange(next.value)
  }

  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-xs text-ink-muted">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} onKeyDown={onKey} className="flex rounded-sm border border-line-hi bg-bg p-0.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              title={o.title}
              disabled={disabled || o.disabled}
              onClick={() => onChange(o.value)}
              className={
                'flex-1 rounded-[4px] px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ' +
                (on ? 'bg-crimson text-white' : 'text-ink-muted hover:text-ink')
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
