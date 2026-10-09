import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}

/** Kolom cari ringkas untuk bilah alat tabel. */
export default function SearchInput({ value, onChange, placeholder, label }: Props) {
  return (
    <label className="relative block w-full max-w-xs">
      <span className="sr-only">{label}</span>
      <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-sm border border-line-hi bg-bg pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-crimson focus:outline-none"
      />
    </label>
  )
}
