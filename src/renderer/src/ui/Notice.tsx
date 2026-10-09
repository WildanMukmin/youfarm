import type { ReactNode } from 'react'

type Tone = 'warn' | 'error' | 'info'

const TONES: Record<Tone, string> = {
  warn: 'border-[#6B4D10] text-amber',
  error: 'border-[#6B2E18] text-err',
  info: 'border-line-hi text-ink-muted'
}

export default function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-sm border bg-panel-2 px-4 py-3 text-sm ${TONES[tone]}`}>
      {title && <div className="mb-1 font-medium">{title}</div>}
      <div className="text-ink-muted">{children}</div>
    </div>
  )
}
