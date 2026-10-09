import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { MAX_SLOTS, type YoutubeAccountInfo } from '@shared/youtube/accounts'
import { isValidSlotTime, normalizeSlots } from '@shared/youtube/schedule'
import type { QueueItem } from '@shared/youtube/queue'
import { formatSlot } from '@/lib/format'
import { SLOT_PRESETS, suggestSlot, upcomingSlots } from '@/lib/slots'
import Button from '@/ui/Button'
import Panel from '@/ui/Panel'

interface Props {
  account: YoutubeAccountInfo
  queueItems: QueueItem[]
  onSave: (times: string[]) => Promise<boolean>
  onClose: () => void
}

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

/** Panel kanan halaman Akun: jam tayang satu channel, dengan pratinjau slot kosong berikutnya. */
export default function SlotEditor({ account, queueItems, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>(account.slots)
  const [busy, setBusy] = useState(false)

  // Ganti channel: mulai dari jam tayang channel itu.
  useEffect(() => setDraft(account.slots), [account.channel.id, account.slots])

  const valid = draft.length > 0 && draft.every(isValidSlotTime)
  const clean = normalizeSlots(draft)
  const duplicate = valid && clean.length !== draft.length
  const dirty = !sameList(clean, account.slots)
  const preview = useMemo(() => (valid ? upcomingSlots(clean, queueItems, account.channel.id, 4) : []), [valid, clean.join(','), queueItems, account.channel.id])
  const scheduled = queueItems.filter((i) => i.channelId === account.channel.id && i.publishAt && i.status !== 'failed' && new Date(i.publishAt) > new Date()).length

  const save = async () => {
    setBusy(true)
    if (await onSave(clean)) setDraft(clean)
    setBusy(false)
  }

  return (
    <Panel
      title="Jam tayang"
      actions={
        <button onClick={onClose} aria-label="Tutup panel jam tayang" className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-panel-2 hover:text-ink">
          <X size={15} />
        </button>
      }
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!valid || !dirty || busy} onClick={() => void save()}>
            {busy ? 'Menyimpan…' : 'Simpan jam tayang'}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(account.slots)}>
              Batal
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-5">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-semibold" title={account.channel.title}>
            {account.channel.title}
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">Video yang dijadwalkan masuk ke jam kosong berikutnya. Waktu mengikuti jam komputer ini.</p>
        </div>

        <div>
          <div className="mb-2 text-xs text-ink-muted">Preset</div>
          <div className="flex flex-wrap gap-1.5">
            {SLOT_PRESETS.map((p) => {
              const on = sameList(clean, p.times)
              return (
                <button
                  key={p.label}
                  onClick={() => setDraft(p.times)}
                  aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-crimson bg-crimson/15 text-crimson-hi' : 'border-line-hi text-ink-muted hover:text-ink'}`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs text-ink-muted">
            <span>Jam ({draft.length}/{MAX_SLOTS})</span>
          </div>
          <ul className="grid gap-1.5">
            {draft.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={t}
                  aria-label={`Jam tayang ${i + 1}`}
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                  className="tabular h-9 flex-1 rounded-sm border border-line-hi bg-bg px-3 font-mono text-sm text-ink focus:border-crimson focus:outline-none [color-scheme:dark]"
                />
                <button
                  onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  disabled={draft.length <= 1}
                  aria-label={`Hapus jam ${t}`}
                  className="grid h-9 w-9 place-items-center rounded-sm border border-line-hi text-ink-muted hover:border-crimson hover:text-crimson-hi disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setDraft((d) => [...d, suggestSlot(d)])}
            disabled={draft.length >= MAX_SLOTS}
            className="mt-2 flex items-center gap-1.5 text-xs text-crimson-hi hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={13} /> Tambah jam
          </button>
          {duplicate && <p className="mt-2 text-xs text-amber">Ada jam yang sama; akan disimpan sekali.</p>}
          {!valid && <p className="mt-2 text-xs text-err">Isi minimal satu jam yang valid.</p>}
        </div>

        <div>
          <div className="mb-2 text-xs text-ink-muted">Slot kosong berikutnya{scheduled ? ` · ${scheduled} sudah terjadwal` : ''}</div>
          {preview.length ? (
            <ol className="grid gap-1">
              {preview.map((s, i) => (
                <li key={s} className="flex items-center gap-2 font-mono text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-crimson' : 'bg-line-hi'}`} aria-hidden />
                  <span className={i === 0 ? 'text-ink' : 'text-ink-muted'}>{formatSlot(s)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-ink-muted">—</p>
          )}
          {dirty && valid && <p className="mt-2 text-[11px] text-amber">Pratinjau memakai jam yang belum disimpan.</p>}
        </div>

      </div>
    </Panel>
  )
}
