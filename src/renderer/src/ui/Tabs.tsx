import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  children: ReactNode
}

/** Tab dengan navigasi keyboard (panah kiri/kanan, Home, End). Isi panel diberikan oleh pemanggil. */
export default function Tabs<T extends string>({ tabs, active, onChange, children }: Props<T>) {
  const base = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((t, i) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ' +
                (on ? 'border-crimson text-ink' : 'border-transparent text-ink-muted hover:text-ink')
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`}>
        {children}
      </div>
    </div>
  )
}
