import { useMemo, useState } from 'react'
import { KeySquare, Link2, UsersRound } from 'lucide-react'
import type { AccountState } from '@shared/youtube/accounts'
import { useFitRows } from '@/hooks/useFitRows'
import { useStickyState } from '@/hooks/useStickyState'
import { useYoutubeAccounts } from '@/hooks/useYoutubeAccounts'
import Workspace from '@/layout/Workspace'
import { paginate } from '@/lib/paginate'
import Button from '@/ui/Button'
import EmptyState from '@/ui/EmptyState'
import Pagination, { AUTO } from '@/ui/Pagination'
import SearchInput from '@/ui/SearchInput'
import Segments from '@/ui/Segments'
import StatusChip from '@/ui/StatusChip'
import ChannelsTable, { HEAD_HEIGHT, ROW_HEIGHT, densityFor } from './ChannelsTable'
import CredentialsPanel from './CredentialsPanel'

type Filter = 'all' | 'ok' | 'action' | 'unchecked'

const MATCH: Record<Filter, (s: AccountState) => boolean> = {
  all: () => true,
  ok: (s) => s === 'ok',
  action: (s) => s === 'reconnect' || s === 'needs-analytics',
  unchecked: (s) => s === 'unchecked'
}

export default function AccountsView() {
  const yt = useYoutubeAccounts()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useStickyState<Filter>('akun:filter', 'all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useStickyState('akun:per-page', AUTO)
  const fit = useFitRows(ROW_HEIGHT, HEAD_HEIGHT)

  const accounts = yt.status?.accounts ?? []
  const count = (f: Filter): number => accounts.filter((a) => MATCH[f](a.state)).length
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts.filter((a) => MATCH[filter](a.state) && (!q || a.channel.title.toLowerCase().includes(q) || a.channel.id.toLowerCase().includes(q)))
  }, [accounts, query, filter])
  const pg = paginate(filtered, page, perPage === AUTO ? fit.rows : perPage)
  const needAction = count('action')

  const actions = yt.connecting ? (
    <>
      <StatusChip tone="active">Menunggu izin di browser</StatusChip>
      <Button variant="ghost" size="sm" onClick={yt.cancelConnect}>
        Batal
      </Button>
    </>
  ) : (
    <Button size="sm" disabled={!yt.status?.hasCredentials} onClick={() => void yt.connect()}>
      <span className="flex items-center gap-1.5">
        <Link2 size={14} aria-hidden /> Hubungkan channel
      </span>
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
        <EmptyState icon={KeySquare} title="Isi kredensial Google dulu">
          Masukkan Client ID dan Client Secret di panel kiri. Setelah itu tombol Hubungkan channel aktif.
        </EmptyState>
      ) : (
        <>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
            <Segments
              label="Filter status"
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'Semua', count: accounts.length },
                { value: 'ok', label: 'Aktif', count: count('ok') },
                { value: 'action', label: 'Perlu tindakan', count: needAction, tone: 'alert' },
                { value: 'unchecked', label: 'Belum dicek', count: count('unchecked') }
              ]}
            />
            <div className="ml-auto w-64">
              <SearchInput
                label="Cari channel"
                value={query}
                onChange={(v) => {
                  setQuery(v)
                  setPage(1)
                }}
                placeholder="Cari nama atau ID channel"
              />
            </div>
          </div>

          <div ref={fit.ref} className="min-h-0 flex-1 overflow-hidden">
            {accounts.length === 0 ? (
              <EmptyState icon={UsersRound} title="Belum ada channel">
                Klik Hubungkan channel di kanan atas. Anda bisa menghubungkan banyak channel dengan kredensial yang sama.
              </EmptyState>
            ) : pg.total === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-sm text-ink-muted">Tidak ada channel yang cocok dengan filter atau pencarian.</div>
            ) : (
              <ChannelsTable
                density={densityFor(fit.width)}
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
            autoRows={fit.rows}
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
