import { useId } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Teks nilai di kanan label, mis. "92 px". */
  format?: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

/** Slider dengan label dan nilai terkini. Panah keyboard menggeser sesuai `step`. */
export default function RangeField({ label, value, min, max, step = 1, format, onChange, disabled }: Props) {
  const id = useId()
  return (
    <div className={`grid gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-ink-muted">
          {label}
        </label>
        <span className="tabular font-mono text-[11px] text-ink">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-5 w-full cursor-pointer accent-crimson disabled:cursor-not-allowed"
      />
    </div>
  )
}
