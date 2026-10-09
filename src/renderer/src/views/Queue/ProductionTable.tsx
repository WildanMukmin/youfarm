import { CircleStop, ExternalLink, FolderOpen, RotateCcw, Trash } from 'lucide-react'
import { MODE_INFO } from '@shared/contracts/modes'
import type { ProductionJob, ProductionStatus } from '@shared/production'
import { formatDateTime } from '@/lib/format'
import IconButton, { IconGap } from '@/ui/IconButton'
import StatusChip from '@/ui/StatusChip'

type Tone = 'active' | 'done' | 'warn' | 'error' | 'idle'

const STATUS: Record<ProductionStatus, { tone: Tone; label: string }> = {
  queued: { tone: 'idle', label: 'Antre' },
  running: { tone: 'active', label: 'Dibuat' },
  done: { tone: 'done', label: 'Jadi' },
  failed: { tone: 'error', label: 'Gagal' },
  cancelled: { tone: 'idle', label: 'Dibatalkan' }
}

const STAGE: Record<string, string> = { script: 'Naskah', voice: 'Suara', visual: 'Footage', render: 'Render', thumbnail: 'Thumbnail', done: 'Selesai' }
const MODE_LABEL = Object.fromEntries(MODE_INFO.map((m) => [m.id, m.label]))

export const ROW_HEIGHT = 56
export const HEAD_HEIGHT = 37

/** full: semua kolom; medium: tanpa Diperbarui; narrow: tanpa Publikasi (masuk ke baris kecil). */
export type Density = 'full' | 'medium' | 'narrow'
export const densityFor = (width: number): Density => (width >= 980 ? 'full' : width >= 720 ? 'medium' : 'narrow')

interface Props {
  density: Density
  rows: ProductionJob[]
  channelNames: Record<string, string>
  onCancel: (id: number) => void
  onRetry: (id: number) => void
  onRemove: (id: number) => void
  onOpen: (id: number, what: 'file' | 'folder') => void
  onOpenUpload: () => void
}

const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-panel px-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted'
const td = 'border-b border-line px-3 align-middle'
const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

function publishText(j: ProductionJob, names: Record<string, string>): string {
  if (!j.publish) return 'Tidak diunggah otomatis'
  const ch = names[j.publish.channelId] ?? j.publish.channelId
  return `${ch} · ${j.publish.schedule ? 'jam tayang' : 'langsung'}`
}

/** Tabel antrean produksi. Baris yang sedang dibuat menampilkan tahap dan progres langsung. */
export default function ProductionTable({ density, rows, channelNames, onCancel, onRetry, onRemove, onOpen, onOpenUpload }: Props) {
  const showPublish = density !== 'narrow'
  const showUpdated = density === 'full'
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col />
        <col className="w-[190px]" />
        {showPublish && <col className="w-[190px]" />}
        {showUpdated && <col className="w-[120px]" />}
        <col className="w-[112px]" />
      </colgroup>
      <thead>
        <tr style={{ height: HEAD_HEIGHT }}>
          <th className={th}>Video</th>
          <th className={th}>Status</th>
          {showPublish && <th className={th}>Setelah jadi</th>}
          {showUpdated && <th className={th}>Diperbarui</th>}
          <th className={`${th} text-right`}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((j) => {
          const s = STATUS[j.status]
          // Error menggantikan baris kecil; catatan (mis. naskah agak pendek) cukup penanda dengan detail di tooltip.
          const meta = [j.title ? j.topic : null, MODE_LABEL[j.mode] ?? j.mode, j.durationSec ? mmss(j.durationSec) : null, !showPublish && j.publish ? publishText(j, channelNames) : null]
            .filter(Boolean)
            .join(' · ')
          const failed = j.status === 'failed' && j.errorMessage
          return (
            <tr key={j.id} style={{ height: ROW_HEIGHT }} className="hover:bg-panel-2">
              <td className={td}>
                <div className="truncate font-medium" title={j.title ?? j.topic}>
                  {j.title ?? j.topic}
                </div>
                {failed ? (
                  <div className="truncate text-xs text-err" title={j.errorMessage ?? undefined}>
                    {j.errorMessage}
                  </div>
                ) : (
                  <div className="flex min-w-0 items-baseline gap-1.5 text-xs text-ink-muted">
                    <span className="truncate" title={meta}>
                      {meta}
                    </span>
                    {j.warning && (
                      <span className="shrink-0 cursor-help text-amber" title={j.warning}>
                        · ada catatan
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td className={td}>
                {j.status === 'running' ? (
                  <div className="grid gap-1 pr-2">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-ink">{j.stage ? (STAGE[j.stage] ?? j.stage) : 'Menyiapkan'}</span>
                      <span className="tabular font-mono text-crimson-hi">{j.percent}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-crimson/15" role="progressbar" aria-label={`Progres ${j.title ?? j.topic}`} aria-valuenow={j.percent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-crimson transition-[width] duration-500" style={{ width: `${j.percent}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <StatusChip tone={s.tone}>{s.label}</StatusChip>
                    {j.status === 'done' && j.uploadId && (
                      <button onClick={onOpenUpload} className="mt-0.5 block truncate text-[11px] text-crimson-hi hover:underline">
                        Masuk antrean upload
                      </button>
                    )}
                    {j.status === 'failed' && j.attempts > 1 && <div className="mt-0.5 font-mono text-[11px] text-ink-muted">Percobaan {j.attempts}</div>}
                  </>
                )}
              </td>
              {showPublish && (
                <td className={`${td} truncate text-xs ${j.publish ? 'text-ink' : 'text-ink-muted'}`} title={publishText(j, channelNames)}>
                  {publishText(j, channelNames)}
                </td>
              )}
              {showUpdated && <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{formatDateTime(j.updatedAt)}</td>}
              <td className={td}>
                <div className="flex justify-end gap-1.5">
                  {/* Tiga slot tetap supaya ikon sejajar antar baris: aksi utama, folder, hapus. */}
                  {j.status === 'queued' || j.status === 'running' ? (
                    <IconButton
                      icon={CircleStop}
                      label="Batalkan"
                      confirm={j.status === 'running' ? { message: 'Batalkan video yang sedang dibuat? Kemajuannya hilang.', action: 'Batalkan' } : undefined}
                      onClick={() => onCancel(j.id)}
                    />
                  ) : j.status === 'done' ? (
                    <IconButton icon={ExternalLink} label="Buka video" onClick={() => onOpen(j.id, 'file')} />
                  ) : (
                    <IconButton icon={RotateCcw} tone="primary" label="Coba lagi" onClick={() => onRetry(j.id)} />
                  )}
                  {j.status === 'done' ? <IconButton icon={FolderOpen} label="Tampilkan di folder" onClick={() => onOpen(j.id, 'folder')} /> : <IconGap />}
                  {j.status === 'running' ? (
                    <IconGap />
                  ) : (
                    <IconButton
                      icon={Trash}
                      label={j.status === 'done' ? 'Hapus video dan berkasnya' : 'Hapus dari daftar'}
                      confirm={
                        j.status === 'done'
                          ? { message: `Hapus video ini beserta berkasnya (mp4, thumbnail, caption) dari komputer?${j.uploadId ? ' Upload yang masih menunggu ikut dibatalkan.' : ''} Tidak bisa dibatalkan.`, action: 'Hapus' }
                          : { message: 'Hapus dari antrean produksi?', action: 'Hapus' }
                      }
                      onClick={() => onRemove(j.id)}
                    />
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
