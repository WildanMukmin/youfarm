import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}

/** Keadaan kosong di tengah area kerja: ikon, judul, penjelasan, satu aksi. */
export default function EmptyState({ icon: Icon, title, children, action }: Props) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-md border border-line-hi bg-panel text-ink-muted">
        <Icon size={22} strokeWidth={1.6} aria-hidden />
      </span>
      <p className="font-display text-base font-semibold">{title}</p>
      <div className="max-w-sm text-sm text-ink-muted">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
