import type { ProductionDetail } from '@shared/production'
import Notice from '@/ui/Notice'

/** Naskah, deskripsi, dan tag hasil job. Berlaku untuk semua mode yang punya naskah. */
export default function ScriptPanel({ result }: { result: ProductionDetail | null }) {
  if (!result) return <p className="text-sm text-ink-muted">Naskah muncul di sini setelah video selesai dibuat.</p>
  return (
    <div className="grid gap-5">
      <div>
        <div className="mb-1 text-xs text-ink-muted">Judul</div>
        <div className="font-display text-base font-semibold">{result.video.title}</div>
      </div>
      {result.hook && (
        <div>
          <div className="mb-1 text-xs text-ink-muted">Hook</div>
          <p className="rounded-sm border border-line-hi bg-bg px-3 py-2 text-sm font-semibold leading-snug text-crimson-hi">{result.hook}</p>
        </div>
      )}
      {result.warnings.map((w) => (
        <Notice key={w} tone="warn">
          {w}
        </Notice>
      ))}
      {result.sentences.length > 0 ? (
        <div>
          <div className="mb-2 text-xs text-ink-muted">Naskah ({result.sentences.length} kalimat)</div>
          <ol className="grid gap-2">
            {result.sentences.map((s, i) => (
              <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-sm leading-relaxed">
                <span className="font-mono text-xs text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{result.video.script || 'Naskah video ini tidak tersimpan.'}</p>
      )}
      {result.description && (
        <div>
          <div className="mb-1 text-xs text-ink-muted">Deskripsi</div>
          <p className="text-sm text-ink-muted">{result.description}</p>
        </div>
      )}
      {result.tags.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-ink-muted">Tag</div>
          <div className="flex flex-wrap gap-1.5">
            {result.tags.map((t) => (
              <span key={t} className="rounded-full border border-line-hi px-2.5 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
