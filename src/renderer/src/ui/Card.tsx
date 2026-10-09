import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  children: ReactNode
}

export default function Card({ title, description, children }: Props) {
  return (
    <section className="min-w-0 rounded-md border border-line bg-panel p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
