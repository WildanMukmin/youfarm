import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  /** Isi kanan bilah judul: status atau aksi utama. */
  actions?: ReactNode
  left?: ReactNode
  right?: ReactNode
  /** Lebar panel samping (px). */
  leftWidth?: number
  rightWidth?: number
  children: ReactNode
}

/**
 * Tata letak ala editor: bilah judul di atas, panel kiri dan kanan dengan scroll masing-masing,
 * area kerja di tengah. Halaman tidak pernah memanjang ke bawah.
 */
export default function Workspace({ title, subtitle, actions, left, right, leftWidth = 340, rightWidth = 340, children }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-5">
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1">
        {left && (
          <aside className="flex min-h-0 shrink-0 flex-col border-r border-line bg-panel" style={{ width: leftWidth }}>
            {left}
          </aside>
        )}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
        {right && (
          <aside className="flex min-h-0 shrink-0 flex-col border-l border-line bg-panel" style={{ width: rightWidth }}>
            {right}
          </aside>
        )}
      </div>
    </div>
  )
}
