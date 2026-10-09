import type { KeyboardEvent } from 'react'

interface Props<T extends string> {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  label: string
}

/** Tab kecil di kepala panel. Panah kiri/kanan berpindah tab. */
export default function PanelTabs<T extends string>({ tabs, active, onChange, label }: Props<T>) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = tabs.findIndex((t) => t.id === active)
    onChange(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id)
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="-mb-px flex h-10 gap-3">
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`border-b-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${on ? 'border-crimson text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
