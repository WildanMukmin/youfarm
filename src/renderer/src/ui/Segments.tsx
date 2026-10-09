interface Props<T extends string> {
  label: string
  value: T
  options: { value: T; label: string; count?: number; tone?: 'alert' }[]
  onChange: (v: T) => void
}

/** Filter cepat berbentuk pil di bilah alat, dengan jumlah per pilihan. */
export default function Segments<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 shrink-0 items-center rounded-sm border border-line-hi bg-bg p-0.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex h-full items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 text-xs font-medium transition-colors ${on ? 'bg-panel-2 text-ink shadow-[inset_0_-2px_0_var(--crimson)]' : 'text-ink-muted hover:text-ink'}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`tabular font-mono text-[10px] ${o.tone === 'alert' && o.count > 0 ? 'text-err' : 'text-ink-muted'}`}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
