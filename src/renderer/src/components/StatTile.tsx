import type { ReactNode } from 'react'

interface Props {
  label: string
  value: number | string
  /** Teks kecil di bawah nilai. */
  hint?: ReactNode
  tone?: 'default' | 'alert' | 'ok' | 'accent'
  /** Bila ada, tile bisa diklik (mis. untuk memfilter tabel). */
  onClick?: () => void
  active?: boolean
}

const nf = new Intl.NumberFormat('id-ID')

/** Satu angka ringkasan. Nilai memakai sans semibold (figur proporsional), warna teks tetap netral. */
export default function StatTile({ label, value, hint, tone = 'default', onClick, active }: Props) {
  const on = typeof value === 'number' ? value > 0 : Boolean(value)
  const mark = tone === 'alert' && on ? 'bg-err' : tone === 'ok' && on ? 'bg-ok' : tone === 'accent' && on ? 'bg-crimson' : 'bg-line-hi'
  const body = (
    <>
      <div className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-muted">
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${mark}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate font-semibold leading-none text-ink ${typeof value === 'number' ? 'text-2xl' : 'text-lg leading-6'}`}>{typeof value === 'number' ? nf.format(value) : value}</div>
      {hint && <div className="mt-1.5 truncate text-[11px] text-ink-muted">{hint}</div>}
    </>
  )
  const cls = `min-w-0 rounded-sm border px-4 py-3 text-left transition-colors ${active ? 'border-crimson bg-panel-2' : 'border-line bg-panel'}`
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} hover:border-crimson-dim`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
