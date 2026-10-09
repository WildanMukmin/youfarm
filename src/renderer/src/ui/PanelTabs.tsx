import type { KeyboardEvent, ReactNode } from 'react'

export interface TabSpec<T extends string> {
  id: T
  label: string
  /** Angka kecil di samping label (mis. jumlah item). */
  count?: number
  /** Penanda singkat bila tab belum tersedia, mis. "Segera". */
  soon?: string
  icon?: ReactNode
}

interface Props<T extends string> {
  tabs: TabSpec<T>[]
  active: T
  onChange: (id: T) => void
  label: string
  /** 'compact' untuk kepala panel, 'bar' untuk bilah tab halaman. */
  variant?: 'compact' | 'bar'
}

/** Tab dengan garis bawah aktif. Panah kiri/kanan berpindah tab (melewati yang belum tersedia). */
export default function PanelTabs<T extends string>({ tabs, active, onChange, label, variant = 'compact' }: Props<T>) {
  const usable = tabs.filter((t) => !t.soon)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = usable.findIndex((t) => t.id === active)
    onChange(usable[(i + (e.key === 'ArrowRight' ? 1 : usable.length - 1)) % usable.length].id)
  }
  const bar = variant === 'bar'
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={`-mb-px flex ${bar ? 'h-11 gap-6' : 'h-10 gap-3'}`}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            aria-disabled={Boolean(t.soon)}
            tabIndex={on ? 0 : -1}
            onClick={() => !t.soon && onChange(t.id)}
            title={t.soon ? `${t.label}: ${t.soon.toLowerCase()}` : undefined}
            className={
              'flex items-center gap-2 border-b-2 transition-colors ' +
              (bar ? 'text-sm font-medium ' : 'font-mono text-[11px] uppercase tracking-wider ') +
              (t.soon ? 'cursor-not-allowed border-transparent text-ink-muted/60' : on ? 'border-crimson text-ink' : 'border-transparent text-ink-muted hover:text-ink')
            }
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={`tabular rounded-full px-1.5 py-px font-mono text-[10px] ${on ? 'bg-crimson/20 text-crimson-hi' : 'bg-panel-2 text-ink-muted'}`}>{t.count}</span>
            )}
            {t.soon && <span className="rounded-full border border-line-hi px-1.5 py-px font-mono text-[10px] normal-case tracking-normal">{t.soon}</span>}
          </button>
        )
      })}
    </div>
  )
}
