import type { ErrorKind } from '@shared/youtube/errors'
import type { QueueItem, UploadStatus } from '@shared/youtube/queue'
import Button from '@/ui/Button'
import ConfirmButton from '@/ui/ConfirmButton'
import StatusChip from '@/ui/StatusChip'
import { formatDateTime } from '@/lib/format'

type Tone = 'active' | 'done' | 'warn' | 'error' | 'idle'

const STATUS: Record<UploadStatus, { tone: Tone; label: string }> = {
  queued: { tone: 'idle', label: 'Antre' },
  uploading: { tone: 'active', label: 'Mengunggah' },
  done: { tone: 'done', label: 'Selesai' },
  failed: { tone: 'error', label: 'Gagal' },
  blocked: { tone: 'warn', label: 'Akun bermasalah' }
}

const CAUSE: Record<ErrorKind, string> = {
  item: 'Video bermasalah',
  account: 'Akun perlu dihubungkan ulang',
  retry: 'Gagal sementara',
  quota: 'Kuota habis'
}

interface Props {
  item: QueueItem
  channelName: string
  onRetry: (id: number) => void
  onRemove: (id: number) => void
}

export default function QueueRow({ item, channelName, onRetry, onRemove }: Props) {
  const s = STATUS[item.status]
  const attention = item.status === 'failed' || item.status === 'blocked'
  return (
    <li className="grid gap-3 rounded-sm border border-line-hi p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="truncate font-medium">{item.title}</span>
          <StatusChip tone={s.tone}>{s.label}</StatusChip>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted">
          <span>{channelName}</span>
          <span>{item.mode}</span>
          {item.publishAt && <span>Tayang <span className="font-mono text-ink">{formatDateTime(item.publishAt)}</span></span>}
          {item.notBefore && item.status === 'queued' && <span>Coba lagi <span className="font-mono text-ink">{formatDateTime(item.notBefore)}</span></span>}
          {item.attempts > 0 && item.status !== 'done' && <span>Percobaan <span className="font-mono text-ink">{item.attempts}</span></span>}
        </div>
        {attention && item.errorMessage && (
          <p className="mt-2 text-sm text-err">
            <span className="font-medium">{item.errorKind ? CAUSE[item.errorKind] : 'Gagal'}.</span> {item.errorMessage}
          </p>
        )}
        {item.status === 'queued' && item.errorKind === 'quota' && <p className="mt-2 text-xs text-amber">Menunggu kuota direset.</p>}
        {item.warning && <p className="mt-2 text-xs text-amber">{item.warning}</p>}
      </div>
      <div className="flex gap-2">
        {attention && <Button onClick={() => onRetry(item.id)}>Coba lagi</Button>}
        {item.status !== 'uploading' && (
          <ConfirmButton confirmLabel="Hapus?" onConfirm={() => onRemove(item.id)}>
            Hapus
          </ConfirmButton>
        )}
      </div>
    </li>
  )
}
