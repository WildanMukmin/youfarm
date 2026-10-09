import type { ReactNode } from 'react'
import ScrollArea from './ScrollArea'

interface Props {
  /** Judul kecil di kepala panel, atau elemen (mis. tab). */
  title: ReactNode
  actions?: ReactNode
  /** Bagian bawah yang selalu terlihat (mis. tombol aksi utama). */
  footer?: ReactNode
  /** Tanpa padding isi, untuk tabel atau konten penuh. */
  flush?: boolean
  children: ReactNode
}

/** Panel editor: kepala tipis, isi tanpa scrollbar (bayangan tepi bila ada isi lagi), kaki tetap. */
export default function Panel({ title, actions, footer, flush, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="min-w-0 font-mono text-[11px] uppercase tracking-wider text-ink-muted">{title}</div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <ScrollArea className={flush ? '' : 'p-4'}>{children}</ScrollArea>
      {footer && <div className="shrink-0 border-t border-line p-4">{footer}</div>}
    </div>
  )
}
