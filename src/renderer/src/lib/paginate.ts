export interface Page<T> {
  items: T[]
  /** Halaman aktif (1-based), sudah dijepit ke rentang yang valid. */
  page: number
  pages: number
  /** Nomor urut item pertama dan terakhir di halaman ini (1-based); 0 bila kosong. */
  from: number
  to: number
  total: number
}

export function paginate<T>(items: T[], page: number, perPage: number): Page<T> {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  const start = (p - 1) * perPage
  const slice = items.slice(start, start + perPage)
  return { items: slice, page: p, pages, from: total ? start + 1 : 0, to: start + slice.length, total }
}

/** Nomor halaman yang ditampilkan, dengan elipsis: 1 … 4 5 6 … 12. */
export function pageWindow(page: number, pages: number, span = 1): (number | 'gap')[] {
  if (pages <= 5 + span * 2) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | 'gap')[] = [1]
  const lo = Math.max(2, page - span)
  const hi = Math.min(pages - 1, page + span)
  if (lo > 2) out.push('gap')
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < pages - 1) out.push('gap')
  out.push(pages)
  return out
}
