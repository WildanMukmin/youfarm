export default function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
    </header>
  )
}
