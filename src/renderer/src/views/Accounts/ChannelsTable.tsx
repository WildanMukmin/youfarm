import { Link2, RefreshCw, Unplug } from 'lucide-react'
import type { AccountState, YoutubeAccountInfo } from '@shared/youtube/accounts'
import { formatDate, formatDateTime } from '@/lib/format'
import IconButton from '@/ui/IconButton'
import StatusChip from '@/ui/StatusChip'

type Tone = 'done' | 'idle' | 'error' | 'warn'

export const STATE: Record<AccountState, { tone: Tone; label: string; hint: string }> = {
  ok: { tone: 'done', label: 'Aktif', hint: 'Token berlaku. Izin upload dan analitik ada.' },
  unchecked: { tone: 'idle', label: 'Belum dicek', hint: 'Tekan Cek untuk menguji token tanpa upload.' },
  reconnect: { tone: 'error', label: 'Hubungkan ulang', hint: 'Token tidak berlaku atau izin upload belum diberikan.' },
  'needs-analytics': { tone: 'warn', label: 'Tanpa analitik', hint: 'Bisa upload. Hubungkan ulang dan beri izin analitik untuk dashboard.' }
}

/** full: semua kolom; medium: tanpa Dicek; narrow: hanya channel, status, aksi (tanggal di tooltip status). */
export type Density = 'full' | 'medium' | 'narrow'

export const densityFor = (width: number): Density => (width >= 820 ? 'full' : width >= 640 ? 'medium' : 'narrow')

interface Props {
  density: Density
  rows: YoutubeAccountInfo[]
  busyId: string | null
  connecting: boolean
  onConnect: () => void
  onCheck: (id: string) => void
  onDisconnect: (id: string) => void
}

export const ROW_HEIGHT = 52
export const HEAD_HEIGHT = 37

const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-panel px-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted'
const td = 'border-b border-line px-3 align-middle'

/** Tabel channel YouTube. Satu baris per channel, tinggi seragam supaya puluhan channel mudah dipindai. */
export default function ChannelsTable({ density, rows, busyId, connecting, onConnect, onCheck, onDisconnect }: Props) {
  const showDates = density !== 'narrow'
  const showChecked = density === 'full'
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col />
        <col className="w-[150px]" />
        {showDates && <col className="w-[110px]" />}
        {showChecked && <col className="w-[120px]" />}
        {showDates && <col className="w-[120px]" />}
        <col className="w-[116px]" />
      </colgroup>
      <thead>
        <tr style={{ height: HEAD_HEIGHT }}>
          <th className={th}>Channel</th>
          <th className={th}>Status</th>
          {showDates && <th className={th}>Dihubungkan</th>}
          {showChecked && <th className={th}>Dicek</th>}
          {showDates && (
            <th className={th} title="Berlaku bila app Google Cloud Anda masih berstatus Testing (token 7 hari)">
              Kedaluwarsa*
            </th>
          )}
          <th className={`${th} text-right`}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const s = STATE[a.state]
          const busy = busyId === a.channel.id
          const needs = a.state === 'reconnect' || a.state === 'needs-analytics'
          const perms = `Upload: ${a.canUpload ? 'ya' : 'tidak'} · Analitik: ${a.canAnalytics ? 'ya' : 'tidak'}`
          return (
            <tr key={a.channel.id} style={{ height: ROW_HEIGHT }} className="hover:bg-panel-2">
              <td className={td}>
                <div className="truncate font-medium" title={a.channel.title}>
                  {a.channel.title}
                </div>
                <div className="truncate font-mono text-[11px] text-ink-muted">{a.channel.id}</div>
              </td>
              <td className={`${td} whitespace-nowrap`} title={`${s.hint}\n${perms}\nDihubungkan ${formatDate(a.connectedAt)} · kedaluwarsa (Testing) ${formatDate(a.testingExpiryAt)}`}>
                <StatusChip tone={s.tone}>{s.label}</StatusChip>
              </td>
              {showDates && <td className={`${td} tabular whitespace-nowrap font-mono text-xs`}>{formatDate(a.connectedAt)}</td>}
              {showChecked && <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{a.lastCheckedAt ? formatDateTime(a.lastCheckedAt) : '—'}</td>}
              {showDates && <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{formatDate(a.testingExpiryAt)}</td>}
              <td className={td}>
                <div className="flex justify-end gap-1.5">
                  {needs && <IconButton icon={Link2} tone="primary" label="Hubungkan ulang" disabled={connecting || busy} onClick={onConnect} />}
                  <IconButton icon={RefreshCw} label={busy ? 'Memeriksa…' : 'Cek token'} disabled={busy || connecting} onClick={() => onCheck(a.channel.id)} />
                  <IconButton icon={Unplug} label="Putuskan" confirm="Yakin?" disabled={busy || connecting} onClick={() => onDisconnect(a.channel.id)} />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
