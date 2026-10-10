import { useId, type SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  /** Label tetap ada untuk pembaca layar, tetapi tidak terlihat. */
  hideLabel?: boolean
}

export default function Select({ label, hideLabel = false, className = '', children, ...rest }: Props) {
  const id = useId()
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-xs text-ink-muted'}>
        {label}
      </label>
      <select
        id={id}
        {...rest}
        className={`w-full min-w-0 truncate rounded-sm border border-line-hi bg-bg px-3 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20 ${className}`}
      >
        {children}
      </select>
    </div>
  )
}
