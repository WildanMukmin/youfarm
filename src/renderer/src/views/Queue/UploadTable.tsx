import { ExternalLink, RotateCcw, Trash } from 'lucide-react'
import { MODE_INFO } from '@shared/contracts/modes'
import type { ErrorKind } from '@shared/youtube/errors'
import type { QueueItem, UploadStatus } from '@shared/youtube/queue'
import { formatDateTime } from '@/lib/format'
import IconButton from '@/ui/IconButton'
import StatusChip from '@/ui/StatusChip'

type Tone = 'active' | 'done' | 'warn' | 'error' | 'idle'

const STATUS: Record<UploadStatus, { tone: Tone; label: string }> = {
  queued: { tone: 'idle', label: 'Antre' },
  uploading: { tone: 'active', label: 'Mengunggah' },
  done: { tone: 'done', label: 'Terunggah' },
  failed: { tone: 'error', label: 'Gagal' },
  blocked: { tone: 'warn', label: 'Akun bermasalah' }
}

const CAUSE: Record<ErrorKind, string> = {
  item: 'Video bermasalah',
  account: 'Akun perlu dihubungkan ulang',
  retry: 'Gagal sementara',
  quota: 'Kuota habis'
}

const MODE_LABEL = Object.fromEntries(MODE_INFO.map((m) => [m.id, m.label]))

export const ROW_HEIGHT = 56
export const HEAD_HEIGHT = 37

/** full: semua kolom; medium: tanpa Diperbarui; narrow: Channel pindah ke baris kecil di bawah judul. */
export type Density = 'full' | 'medium' | 'narrow'

export const densityFor = (width: number): Density => (width >= 980 ? 'full' : width >= 720 ? 'medium' : 'narrow')

interface Props {
  density: Density
  rows: QueueItem[]
  channelNames: Record<string, string>
  onRetry: (id: number) => void
  onRemove: (id: number) => void
  onOpen: (id: number) => void
}

const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-panel px-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted'
const td = 'border-b border-line px-3 align-middle'

/** Keterangan kecil di bawah status: alasan menunggu atau jumlah percobaan. */
function statusNote(i: QueueItem): string | null {
  if (i.status === 'queued' && i.errorKind === 'quota') return 'Menunggu kuota'
  if (i.status === 'queued' && i.notBefore) return `Coba lagi ${formatDateTime(i.notBefore)}`
  if (i.status !== 'done' && i.attempts > 0) return `Percobaan ${i.attempts}`
  return null
}

/** Tabel antrean upload. Tinggi baris tetap supaya jumlah baris per halaman bisa dihitung pas layar. */
export default function UploadTable({ density, rows, channelNames, onRetry, onRemove, onOpen }: Props) {
  const showChannel = density !== 'narrow'
  const showUpdated = density === 'full'
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col />
        {showChannel && <col className="w-[160px]" />}
        <col className="w-[150px]" />
        <col className="w-[120px]" />
        {showUpdated && <col className="w-[120px]" />}
        <col className="w-[104px]" />
      </colgroup>
      <thead>
        <tr style={{ height: HEAD_HEIGHT }}>
          <th className={th}>Video</th>
          {showChannel && <th className={th}>Channel</th>}
          <th className={th}>Status</th>
          <th className={th}>Tayang</th>
          {showUpdated && <th className={th}>Diperbarui</th>}
          <th className={`${th} text-right`}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => {
          const s = STATUS[i.status]
          const attention = i.status === 'failed' || i.status === 'blocked'
          const note = statusNote(i)
          const problem = attention && i.errorMessage ? `${i.errorKind ? CAUSE[i.errorKind] : 'Gagal'}: ${i.errorMessage}` : null
          const sub = problem ?? i.warning
          return (
            <tr key={i.id} style={{ height: ROW_HEIGHT }} className="hover:bg-panel-2">
              <td className={td}>
                <div className="truncate font-medium" title={i.title}>
                  {i.title}
                </div>
                <div className={`truncate text-xs ${problem ? 'text-err' : i.warning ? 'text-amber' : 'text-ink-muted'}`} title={sub ?? undefined}>
                  {sub ?? [!showChannel && (channelNames[i.channelId] ?? i.channelId), MODE_LABEL[i.mode] ?? i.mode, `#${i.id}`].filter(Boolean).join(' · ')}
                </div>
              </td>
              {showChannel && (
                <td className={td}>
                  <div className="truncate" title={channelNames[i.channelId] ?? i.channelId}>
                    {channelNames[i.channelId] ?? <span className="font-mono text-xs text-ink-muted">{i.channelId}</span>}
                  </div>
                </td>
              )}
              <td className={td}>
                <StatusChip tone={s.tone}>{s.label}</StatusChip>
                {note && <div className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{note}</div>}
              </td>
              <td className={`${td} tabular whitespace-nowrap font-mono text-xs`}>{i.publishAt ? formatDateTime(i.publishAt) : <span className="text-ink-muted">Langsung</span>}</td>
              {showUpdated && <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{formatDateTime(i.updatedAt)}</td>}
              <td className={td}>
                <div className="flex justify-end gap-1.5">
                  {attention && <IconButton icon={RotateCcw} tone="primary" label="Coba lagi" onClick={() => onRetry(i.id)} />}
                  {i.status === 'done' && i.videoId && <IconButton icon={ExternalLink} label="Buka di YouTube Studio" onClick={() => onOpen(i.id)} />}
                  {i.status !== 'uploading' && <IconButton icon={Trash} label="Hapus dari antrean" confirm="Hapus?" onClick={() => onRemove(i.id)} />}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
