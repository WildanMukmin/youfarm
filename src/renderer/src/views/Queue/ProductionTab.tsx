import { useMemo, useState } from 'react'
import { Factory } from 'lucide-react'
import type { ProductionSnapshot } from '@shared/production'
import StatTile from '@/components/StatTile'
import { useElementSize, useFitRows } from '@/hooks/useFitRows'
import { useStickyState } from '@/hooks/useStickyState'
import { paginate } from '@/lib/paginate'
import { filterProduction, productionCounts, sortProduction, type ProductionFilter } from '@/lib/productionView'
import Button from '@/ui/Button'
import EmptyState from '@/ui/EmptyState'
import Pagination, { AUTO } from '@/ui/Pagination'
import SearchInput from '@/ui/SearchInput'
import Segments from '@/ui/Segments'
import ProductionTable, { HEAD_HEIGHT, ROW_HEIGHT, densityFor } from './ProductionTable'

interface Props {
  snapshot: ProductionSnapshot
  channelNames: Record<string, string>
  onCancel: (id: number) => void
  onRetry: (id: number) => void
  onRemove: (id: number) => void
  onOpen: (id: number, what: 'file' | 'folder') => void
  onOpenUpload: () => void
  onCreate: () => void
}

const startOfToday = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function ProductionTab({ snapshot, channelNames, onCancel, onRetry, onRemove, onOpen, onOpenUpload, onCreate }: Props) {
  const [filter, setFilter] = useStickyState<ProductionFilter>('produksi:filter', 'all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useStickyState('produksi:per-page', AUTO)
  const fit = useFitRows(ROW_HEIGHT, HEAD_HEIGHT)
  const pageSize = useElementSize()
  const wide = pageSize.width === 0 || pageSize.width >= 900

  const items = snapshot.items
  const counts = useMemo(() => productionCounts(items, startOfToday()), [items])
  const current = items.find((j) => j.status === 'running')
  const rows = useMemo(() => sortProduction(filterProduction(items, filter, query)), [items, filter, query])
  const pg = paginate(rows, page, perPage === AUTO ? fit.rows : perPage)

  const pick = (f: ProductionFilter): void => {
    setFilter((cur) => (cur === f ? 'all' : f))
    setPage(1)
  }

  return (
    <div ref={pageSize.ref} className="flex min-h-0 flex-1 flex-col">
      <div className={`grid shrink-0 gap-3 border-b border-line p-4 ${wide ? 'grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(0,1fr))]' : 'grid-cols-[minmax(200px,1.4fr)_repeat(2,minmax(0,1fr))]'}`}>
        <StatTile
          label="Sedang dibuat"
          tone="accent"
          value={current ? `${current.percent}%` : !snapshot.running ? 'Dijeda' : counts.queued ? 'Memulai…' : 'Siap'}
          hint={current ? current.title ?? current.topic : counts.queued ? `${counts.queued} video menunggu` : 'Antrekan topik dari ruang kerja mode'}
        />
        <StatTile label="Menunggu" value={counts.queued} hint="Dibuat satu per satu" active={filter === 'active'} onClick={() => pick('active')} />
        <StatTile label="Gagal" value={counts.failed} tone="alert" hint={counts.failed ? 'Klik untuk melihat' : 'Tidak ada masalah'} active={filter === 'failed'} onClick={() => pick('failed')} />
        {wide && <StatTile label="Jadi hari ini" value={counts.doneToday} tone="ok" hint={`${counts.done} total`} active={filter === 'done'} onClick={() => pick('done')} />}
      </div>

      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <Segments
          label="Filter status"
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setPage(1)
          }}
          options={[
            { value: 'all', label: 'Semua', count: items.length },
            { value: 'active', label: 'Berjalan', count: counts.active },
            { value: 'failed', label: 'Gagal', count: counts.failed, tone: 'alert' },
            { value: 'done', label: 'Jadi', count: counts.done }
          ]}
        />
        <div className="ml-auto w-56 min-w-[140px] shrink">
          <SearchInput
            label="Cari video"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            placeholder="Cari topik atau judul"
          />
        </div>
      </div>

      <div ref={fit.ref} className="min-h-0 flex-1 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="Antrean produksi kosong"
            action={
              <Button variant="ghost" onClick={onCreate}>
                Buka Fakta Unik
              </Button>
            }
          >
            Di ruang kerja mode, tulis beberapa topik (satu per baris) lalu klik Antrekan. Video dibuat satu per satu di latar, dan bisa langsung masuk antrean upload.
          </EmptyState>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-ink-muted">Tidak ada video yang cocok dengan filter atau pencarian.</div>
        ) : (
          <ProductionTable
            density={densityFor(fit.width)}
            rows={pg.items}
            channelNames={channelNames}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            onOpen={onOpen}
            onOpenUpload={onOpenUpload}
          />
        )}
      </div>

      <Pagination
        page={pg}
        perPage={perPage}
        autoRows={fit.rows}
        noun="video"
        onPage={setPage}
        onPerPage={(n) => {
          setPerPage(n)
          setPage(1)
        }}
      />
    </div>
  )
}
