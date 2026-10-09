import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AccountState } from '@shared/youtube/accounts'
import { useYoutubeAccounts } from '@/hooks/useYoutubeAccounts'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import { paginate } from '@/lib/paginate'
import Button from '@/ui/Button'
import Pagination from '@/ui/Pagination'
import StatusChip from '@/ui/StatusChip'
import ChannelsTable from './ChannelsTable'
import CredentialsPanel from './CredentialsPanel'

type Filter = 'all' | 'ok' | 'action' | 'unchecked'

const FILTERS: { id: Filter; label: string; match: (s: AccountState) => boolean }[] = [
  { id: 'all', label: 'Semua status', match: () => true },
  { id: 'ok', label: 'Aktif', match: (s) => s === 'ok' },
  { id: 'action', label: 'Perlu tindakan', match: (s) => s === 'reconnect' || s === 'needs-analytics' },
  { id: 'unchecked', label: 'Belum dicek', match: (s) => s === 'unchecked' }
]

export default function AccountsView() {
  const yt = useYoutubeAccounts()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useStickyState('akun:per-page', 10)

  const accounts = yt.status?.accounts ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find((x) => x.id === filter)!
    return accounts.filter((a) => f.match(a.state) && (!q || a.channel.title.toLowerCase().includes(q) || a.channel.id.toLowerCase().includes(q)))
  }, [accounts, query, filter])
  const pg = paginate(filtered, page, perPage)
  const needAction = accounts.filter((a) => a.state === 'reconnect' || a.state === 'needs-analytics').length

  const actions = yt.connecting ? (
    <>
      <StatusChip tone="active">Menunggu izin di browser</StatusChip>
      <Button variant="ghost" onClick={yt.cancelConnect}>
        Batal
      </Button>
    </>
  ) : (
    <Button disabled={!yt.status?.hasCredentials} onClick={() => void yt.connect()}>
      Hubungkan channel
    </Button>
  )

  return (
    <Workspace
      title="Akun"
      subtitle={yt.status ? `${accounts.length} channel terhubung${needAction ? ` · ${needAction} perlu tindakan` : ''}` : 'Memuat…'}
      actions={actions}
      leftWidth={280}
      left={yt.status && <CredentialsPanel status={yt.status} onSave={yt.setCredentials} onClear={() => void yt.clearCredentials()} />}
    >
      {!yt.status ? null : !yt.status.hasCredentials ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-muted">Isi kredensial Google di panel kiri untuk mulai menghubungkan channel.</div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <label className="relative flex-1">
              <span className="sr-only">Cari channel</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Cari nama atau ID channel"
                className="w-full max-w-sm rounded-sm border border-line-hi bg-bg py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-crimson focus:outline-none"
              />
            </label>
            <label>
              <span className="sr-only">Filter status</span>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as Filter)
                  setPage(1)
                }}
                className="rounded-sm border border-line-hi bg-bg px-2 py-1.5 text-sm text-ink focus:border-crimson focus:outline-none"
              >
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {accounts.length === 0 ? (
              <p className="p-6 text-sm text-ink-muted">Belum ada channel yang terhubung. Klik Hubungkan channel di kanan atas.</p>
            ) : pg.total === 0 ? (
              <p className="p-6 text-sm text-ink-muted">Tidak ada channel yang cocok dengan pencarian atau filter.</p>
            ) : (
              <ChannelsTable
                rows={pg.items}
                busyId={yt.busyId}
                connecting={yt.connecting}
                onConnect={() => void yt.connect()}
                onCheck={(id) => void yt.check(id)}
                onDisconnect={(id) => void yt.disconnect(id)}
              />
            )}
          </div>

          <Pagination
            page={pg}
            perPage={perPage}
            noun="channel"
            onPage={setPage}
            onPerPage={(n) => {
              setPerPage(n)
              setPage(1)
            }}
          />
        </>
      )}
    </Workspace>
  )
}
