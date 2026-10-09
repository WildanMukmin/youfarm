import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  /** Label untuk pembaca layar dan tooltip. */
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'primary'
  /** Bila diisi, klik pertama meminta konfirmasi (teks ini tampil), klik kedua menjalankan. */
  confirm?: string
}

/** Tombol ikon ringkas untuk baris tabel. */
export default function IconButton({ icon: Icon, label, onClick, disabled, tone = 'default', confirm }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const base = 'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-sm border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const look = armed
    ? 'border-err text-err'
    : tone === 'primary'
      ? 'border-transparent bg-crimson text-white hover:brightness-110'
      : 'border-line-hi text-ink-muted hover:border-crimson hover:text-crimson-hi'

  return (
    <button
      type="button"
      aria-label={armed ? `${label}: ${confirm}` : label}
      title={label}
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (confirm && !armed) return setArmed(true)
        setArmed(false)
        onClick()
      }}
      className={`${base} ${look}`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {armed && <span>{confirm}</span>}
    </button>
  )
}
