type Tone = 'active' | 'done' | 'warn' | 'error' | 'idle'

const TONES: Record<Tone, string> = {
  active: 'text-crimson-hi border-crimson-dim',
  done: 'text-ok border-[#115E55]',
  warn: 'text-amber border-[#6B4D10]',
  error: 'text-err border-[#6B2E18]',
  idle: 'text-ink-muted border-line-hi'
}

export default function StatusChip({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-xs font-medium ${TONES[tone]}`}>
      <i className="h-[7px] w-[7px] rounded-full bg-current" />
      {children}
    </span>
  )
}
