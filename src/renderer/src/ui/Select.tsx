import { useId, type SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

export default function Select({ label, className = '', children, ...rest }: Props) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        {...rest}
        className={`rounded-sm border border-line-hi bg-bg px-3 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20 ${className}`}
      >
        {children}
      </select>
    </div>
  )
}
