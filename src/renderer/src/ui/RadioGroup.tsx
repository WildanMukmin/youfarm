import { useId } from 'react'

export interface RadioOption<T extends string> {
  value: T
  label: string
  hint?: string
  disabled?: boolean
  /** Ditampilkan sebagai pengganti hint bila opsi nonaktif. */
  disabledReason?: string
}

interface Props<T extends string> {
  legend: string
  value: T
  options: RadioOption<T>[]
  onChange: (value: T) => void
}

export default function RadioGroup<T extends string>({ legend, value, options, onChange }: Props<T>) {
  const name = useId()
  return (
    <fieldset className="grid content-start gap-2">
      <legend className="mb-1 text-xs text-ink-muted">{legend}</legend>
      <div className="grid auto-rows-min gap-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {options.map((o) => {
          const on = o.value === value
          return (
            <label
              key={o.value}
              className={
                'flex cursor-pointer flex-col gap-0.5 rounded-sm border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-crimson-hi ' +
                (o.disabled
                  ? 'cursor-not-allowed border-line opacity-60'
                  : on
                    ? 'border-crimson bg-panel-2 shadow-glow'
                    : 'border-line-hi hover:border-crimson-dim')
              }
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              <span className={on ? 'font-medium text-ink' : 'text-ink'}>{o.label}</span>
              {(o.disabled ? o.disabledReason : o.hint) && (
                <span className="text-xs text-ink-muted">{o.disabled ? o.disabledReason : o.hint}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
