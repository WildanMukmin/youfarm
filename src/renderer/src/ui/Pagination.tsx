import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageWindow, type Page } from '@/lib/paginate'

interface Props {
  page: Page<unknown>
  perPage: number
  perPageOptions?: number[]
  onPage: (p: number) => void
  onPerPage: (n: number) => void
  /** Kata benda untuk ringkasan, mis. "channel". */
  noun: string
}

const btn = 'grid h-8 min-w-8 place-items-center rounded-sm border px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40'

export default function Pagination({ page, perPage, perPageOptions = [10, 25, 50], onPage, onPerPage, noun }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span>
          {page.total === 0 ? `0 ${noun}` : `${page.from}–${page.to} dari ${page.total} ${noun}`}
        </span>
        <label className="flex items-center gap-1.5">
          <span>Per halaman</span>
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="rounded-sm border border-line-hi bg-bg px-1.5 py-1 font-mono text-xs text-ink focus:border-crimson focus:outline-none"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav aria-label="Halaman" className="flex items-center gap-1">
        <button className={`${btn} border-line-hi text-ink-muted hover:text-ink`} disabled={page.page <= 1} onClick={() => onPage(page.page - 1)} aria-label="Halaman sebelumnya">
          <ChevronLeft size={14} />
        </button>
        {pageWindow(page.page, page.pages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 font-mono text-xs text-ink-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              aria-current={p === page.page ? 'page' : undefined}
              className={`${btn} ${p === page.page ? 'border-crimson bg-crimson text-white' : 'border-line-hi text-ink-muted hover:text-ink'}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button className={`${btn} border-line-hi text-ink-muted hover:text-ink`} disabled={page.page >= page.pages} onClick={() => onPage(page.page + 1)} aria-label="Halaman berikutnya">
          <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  )
}
