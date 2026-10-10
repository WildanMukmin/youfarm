import { RotateCw } from 'lucide-react'
import Field from '@/ui/Field'
import Select from '@/ui/Select'

interface Props {
  label: string
  value: string
  options: string[]
  loading: boolean
  error: string | null
  /** Key penyedia belum ada, jadi daftar belum bisa dimuat. */
  blockedReason: string | null
  onChange: (model: string) => void
  onReload: () => void
}

/** Pilih model dari daftar API penyedia. Model tersimpan yang belum ada di daftar tetap tampil. */
export default function ModelSelect({ label, value, options, loading, error, blockedReason, onChange, onReload }: Props) {
  const list = value && !options.includes(value) ? [value, ...options] : options
  const blocked = loading || Boolean(blockedReason)
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs text-ink-muted" aria-hidden>{label}</span>
        <button
          type="button"
          aria-label={`Muat ulang ${label.toLowerCase()}`}
          title="Muat ulang daftar model"
          disabled={blocked}
          onClick={onReload}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-ink-muted transition-colors hover:bg-panel-2 hover:text-crimson-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </div>
      {list.length > 0 ? (
        <Select label={label} hideLabel value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{loading ? 'Memuat model…' : 'Pilih model…'}</option>
          {list.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      ) : (
        <Field label={label} hideLabel value={value} placeholder={loading ? 'Memuat model…' : 'Ketik nama model'} onChange={(e) => onChange(e.target.value)} />
      )}
      {(blockedReason ?? error) && <p className="text-[11px] text-ink-muted">{blockedReason ?? error}</p>}
    </div>
  )
}
