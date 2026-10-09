import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ProductionDetail } from '@shared/production'
import type { Privacy } from '@shared/youtube/metadata'
import type { YoutubeAccountInfo } from '@shared/youtube/accounts'
import { errMsg } from '@/lib/errors'
import { formatClock, formatDateTime, formatSlot } from '@/lib/format'
import { upcomingSlots } from '@/lib/slots'
import { refreshQueues, useQueue } from '@/hooks/useQueue'
import Button from '@/ui/Button'
import Checkbox from '@/ui/Checkbox'
import Notice from '@/ui/Notice'
import Select from '@/ui/Select'

const PRIVACY: { value: Privacy; label: string }[] = [
  { value: 'public', label: 'Publik' },
  { value: 'unlisted', label: 'Tidak terdaftar' },
  { value: 'private', label: 'Pribadi' }
]

interface Props {
  result: ProductionDetail
  onOpenQueue: () => void
  onOpenAccounts: () => void
}

/** Masukkan video yang sudah jadi ke antrean upload YouTube. Berlaku untuk semua mode produksi. */
export default function PublishPanel({ result, onOpenQueue, onOpenAccounts }: Props) {
  const [accounts, setAccounts] = useState<YoutubeAccountInfo[] | null>(null)
  const { snapshot } = useQueue()
  const [channelId, setChannelId] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('public')
  const [schedule, setSchedule] = useState(true)
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState<{ publishAt: string | null } | null>(null)

  useEffect(() => {
    void window.youfarm.youtube.status().then((s) => {
      const ok = s.accounts.filter((a) => a.canUpload)
      setAccounts(ok)
      if (ok.length > 0) setChannelId(ok[0].channel.id)
    })
  }, [])

  if (!queued && result.uploadId) {
    return (
      <Notice tone="info" title="Sudah masuk antrean upload">
        Video ini sudah dikirim ke antrean upload (otomatis, atau dari panel ini sebelumnya).{' '}
        <button className="text-crimson-hi underline underline-offset-2" onClick={onOpenQueue}>
          Lihat antrean
        </button>
      </Notice>
    )
  }

  if (queued) {
    return (
      <Notice tone="info" title="Masuk antrean upload">
        {queued.publishAt ? `Dijadwalkan tayang ${formatDateTime(queued.publishAt)}.` : 'Akan diunggah sesuai giliran.'}{' '}
        <button className="text-crimson-hi underline underline-offset-2" onClick={onOpenQueue}>
          Lihat antrean
        </button>
      </Notice>
    )
  }

  if (accounts && accounts.length === 0) {
    return (
      <Notice tone="warn" title="Belum ada channel YouTube">
        Hubungkan channel di menu Akun untuk mengunggah video ini.{' '}
        <button className="text-crimson-hi underline underline-offset-2" onClick={onOpenAccounts}>
          Buka menu Akun
        </button>
      </Notice>
    )
  }

  const submit = async () => {
    setBusy(true)
    try {
      const r = await window.youfarm.production.publish({ id: result.id, channelId, privacy, schedule })
      setQueued({ publishAt: r.publishAt })
      refreshQueues()
      toast.success('Video dimasukkan ke antrean upload.')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const channel = accounts?.find((a) => a.channel.id === channelId)
  const nextSlot = channel ? upcomingSlots(channel.slots, snapshot?.items ?? [], channel.channel.id, 1)[0] : undefined

  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <Select label="Channel tujuan" value={channelId} onChange={(e) => setChannelId(e.target.value)} disabled={!accounts}>
          {(accounts ?? []).map((a) => (
            <option key={a.channel.id} value={a.channel.id}>
              {a.channel.title}
            </option>
          ))}
        </Select>
        <Select label="Privasi" value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)} disabled={schedule}>
          {PRIVACY.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <Checkbox
        label="Jadwalkan di slot tayang berikutnya"
        hint={
          channel
            ? `Jam tayang channel ini: ${channel.slots.map(formatClock).join(', ')}. Tayang publik otomatis di jam berikutnya yang kosong.`
            : 'Video tayang publik otomatis di jam tayang channel.'
        }
        checked={schedule}
        onChange={(e) => setSchedule(e.target.checked)}
      />
      {schedule && nextSlot && (
        <div className="rounded-sm border border-line-hi bg-bg px-3 py-2.5">
          <div className="text-xs text-ink-muted">Akan tayang</div>
          <div className="mt-0.5 font-mono text-sm text-ink">{formatSlot(nextSlot)}</div>
          <button className="mt-1 text-xs text-crimson-hi underline underline-offset-2" onClick={onOpenAccounts}>
            Ubah jam tayang
          </button>
        </div>
      )}
      <div>
        <Button disabled={!channelId || busy} onClick={() => void submit()}>
          {busy ? 'Memasukkan…' : 'Masukkan ke antrean upload'}
        </Button>
      </div>
    </div>
  )
}
