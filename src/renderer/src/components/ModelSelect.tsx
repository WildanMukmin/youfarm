import Button from '@/ui/Button'
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
  return (
    <div className="grid gap-1.5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {list.length > 0 ? (
            <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">{loading ? 'Memuat model…' : 'Pilih model…'}</option>
              {list.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          ) : (
            <Field label={label} value={value} placeholder={loading ? 'Memuat model…' : 'Ketik nama model'} onChange={(e) => onChange(e.target.value)} />
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-[42px] shrink-0" disabled={loading || Boolean(blockedReason)} onClick={onReload}>
          {loading ? 'Memuat…' : 'Muat ulang'}
        </Button>
      </div>
      {(blockedReason ?? error) && <p className="text-[11px] text-ink-muted">{blockedReason ?? error}</p>}
    </div>
  )
}
