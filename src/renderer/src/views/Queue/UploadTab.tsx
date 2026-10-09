import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import type { QueueSnapshot } from '@shared/youtube/queue'
import StatTile from '@/components/StatTile'
import { useFitRows } from '@/hooks/useFitRows'
import { useStickyState } from '@/hooks/useStickyState'
import { paginate } from '@/lib/paginate'
import { filterQueue, nextAiring, queueCounts, sortQueue, type QueueFilter } from '@/lib/queueView'
import { formatSlot } from '@/lib/format'
import Button from '@/ui/Button'
import InlineSelect from '@/ui/InlineSelect'
import Pagination, { AUTO } from '@/ui/Pagination'
import SearchInput from '@/ui/SearchInput'
import Segments from '@/ui/Segments'
import { useElementSize } from '@/hooks/useFitRows'
import UploadTable, { HEAD_HEIGHT, ROW_HEIGHT, densityFor } from './UploadTable'

interface Props {
  snapshot: QueueSnapshot
  channelNames: Record<string, string>
  onRetry: (id: number) => void
  onRemove: (id: number) => void
  onOpen: (id: number) => void
  onCreate: () => void
}

const startOfToday = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function UploadTab({ snapshot, channelNames, onRetry, onRemove, onOpen, onCreate }: Props) {
  const [filter, setFilter] = useStickyState<QueueFilter>('antrean:filter', 'all')
  const [channelId, setChannelId] = useStickyState('antrean:channel', '')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useStickyState('antrean:per-page', AUTO)
  const fit = useFitRows(ROW_HEIGHT, HEAD_HEIGHT)
  const pageSize = useElementSize()
  const wide = pageSize.width === 0 || pageSize.width >= 900

  const items = snapshot.items
  const counts = useMemo(() => queueCounts(items, startOfToday()), [items])
  const next = useMemo(() => nextAiring(items, new Date()), [items])
  const channels = useMemo(() => [...new Set(items.map((i) => i.channelId))], [items])
  const rows = useMemo(() => sortQueue(filterQueue(items, { filter, channelId, query, channelNames })), [items, filter, channelId, query, channelNames])
  const pg = paginate(rows, page, perPage === AUTO ? fit.rows : perPage)

  const pick = (f: QueueFilter): void => {
    setFilter((cur) => (cur === f ? 'all' : f))
    setPage(1)
  }

  return (
    <div ref={pageSize.ref} className="flex min-h-0 flex-1 flex-col">
      <div className={`grid shrink-0 gap-3 border-b border-line p-4 ${wide ? 'grid-cols-[minmax(240px,1.6fr)_repeat(4,minmax(0,1fr))]' : 'grid-cols-[minmax(200px,1.4fr)_repeat(3,minmax(0,1fr))]'}`}>
        <StatTile
          label="Tayang berikutnya"
          tone="accent"
          value={next ? formatSlot(next.publishAt as string) : 'Belum ada'}
          hint={next ? `${next.title} · ${channelNames[next.channelId] ?? next.channelId}` : 'Jadwalkan dari panel Publikasi'}
        />
        <StatTile label="Menunggu" value={counts.pending} hint={counts.uploading ? `${counts.uploading} sedang diunggah` : 'Siap diunggah'} active={filter === 'pending'} onClick={() => pick('pending')} />
        <StatTile label="Perlu perhatian" value={counts.attention} tone="alert" hint={counts.attention ? 'Klik untuk melihat' : 'Tidak ada masalah'} active={filter === 'attention'} onClick={() => pick('attention')} />
        <StatTile label="Terunggah hari ini" value={counts.doneToday} tone="ok" hint={`${counts.done} total`} active={filter === 'done'} onClick={() => pick('done')} />
        {wide && <StatTile label="Total di antrean" value={items.length} hint={`${channels.length} channel`} active={filter === 'all'} onClick={() => pick('all')} />}
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
            { value: 'pending', label: 'Menunggu', count: counts.pending + counts.uploading },
            { value: 'attention', label: 'Perlu perhatian', count: counts.attention, tone: 'alert' },
            { value: 'done', label: 'Terunggah', count: counts.done }
          ]}
        />
        <InlineSelect
          label="Filter channel"
          value={channelId}
          onChange={(v) => {
            setChannelId(v)
            setPage(1)
          }}
          options={[{ value: '', label: 'Semua channel' }, ...channels.map((c) => ({ value: c, label: channelNames[c] ?? c }))]}
        />
        <div className="ml-auto w-64">
          <SearchInput
            label="Cari video"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            placeholder="Cari judul atau channel"
          />
        </div>
      </div>

      <div ref={fit.ref} className="min-h-0 flex-1 overflow-hidden">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Inbox size={28} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
            <p className="font-display text-base font-semibold">Antrean upload kosong</p>
            <p className="max-w-sm text-sm text-ink-muted">Video yang Anda kirim dari panel Publikasi di ruang kerja mode akan muncul di sini dan diunggah otomatis.</p>
            <Button variant="ghost" onClick={onCreate}>
              Buka Fakta Unik
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-ink-muted">Tidak ada video yang cocok dengan filter atau pencarian.</div>
        ) : (
          <UploadTable density={densityFor(fit.width)} rows={pg.items} channelNames={channelNames} onRetry={onRetry} onRemove={onRemove} onOpen={onOpen} />
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
