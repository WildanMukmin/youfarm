import { useId, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Label tetap ada untuk pembaca layar, tetapi tidak terlihat. */
  hideLabel?: boolean
}

export default function Field({ label, hideLabel = false, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-xs text-ink-muted'}>
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className={`rounded-sm border border-line-hi bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20 ${className}`}
      />
    </div>
  )
}
