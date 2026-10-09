import { useId } from 'react'

const SWATCHES = ['#FFFFFF', '#000000', '#FFD400', '#FFF000', '#FF6A00', '#FF3B30', '#39FF6A', '#2DD4FF', '#FF3DAA']

interface Props {
  label: string
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
}

/** Warna siap pakai ditambah pemilih warna bebas. Nilai #RRGGBB huruf besar. */
export default function ColorField({ label, value, onChange, disabled }: Props) {
  const id = useId()
  const custom = !SWATCHES.includes(value.toUpperCase())
  return (
    <fieldset className={`grid gap-1.5 ${disabled ? 'opacity-50' : ''}`} disabled={disabled}>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-xs text-ink-muted">
        {label}
        <span className="tabular font-mono text-[11px] text-ink">{value.toUpperCase()}</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((hex) => {
          const on = hex === value.toUpperCase()
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Warna ${hex}`}
              aria-pressed={on}
              onClick={() => onChange(hex)}
              className={`h-6 w-6 rounded-sm border transition ${on ? 'border-ink ring-2 ring-crimson' : 'border-line-hi hover:border-ink-muted'}`}
              style={{ background: hex }}
            />
          )
        })}
        <label
          htmlFor={id}
          title="Warna lain"
          className={`relative grid h-6 w-6 cursor-pointer place-items-center overflow-hidden rounded-sm border text-[11px] text-ink-muted ${custom ? 'border-ink ring-2 ring-crimson' : 'border-dashed border-line-hi hover:border-ink-muted'}`}
          style={custom ? { background: value } : undefined}
        >
          {!custom && '+'}
          <span className="sr-only">Warna lain</span>
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </fieldset>
  )
}
