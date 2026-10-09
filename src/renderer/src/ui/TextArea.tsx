import { useId, type TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  /** Teks kecil di kanan label (mis. jumlah baris). */
  aside?: string
  hint?: string
}

export default function TextArea({ label, aside, hint, className = '', ...rest }: Props) {
  const id = useId()
  const hintId = useId()
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-ink-muted">
          {label}
        </label>
        {aside && <span className="tabular font-mono text-[11px] text-ink-muted">{aside}</span>}
      </div>
      <textarea
        id={id}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
        className={`min-h-[76px] w-full resize-none rounded-sm border border-line-hi bg-bg px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20 ${className}`}
      />
      {hint && (
        <p id={hintId} className="text-[11px] text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
