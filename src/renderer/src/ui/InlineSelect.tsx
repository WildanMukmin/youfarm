interface Props<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

/** Pilihan ringkas untuk bilah alat (label hanya untuk pembaca layar). */
export default function InlineSelect<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 max-w-[200px] truncate rounded-sm border border-line-hi bg-bg px-2 text-sm text-ink focus:border-crimson focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
