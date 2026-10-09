import { useId, type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hint?: string
}

export default function Checkbox({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input id={id} type="checkbox" {...rest} className="mt-0.5 h-4 w-4 shrink-0 accent-crimson" />
      <label htmlFor={id} className="cursor-pointer text-sm">
        {label}
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </label>
    </div>
  )
}
