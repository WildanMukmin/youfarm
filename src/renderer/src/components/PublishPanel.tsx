import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ModeRunResult } from '@shared/ipc-channels'
import type { Privacy } from '@shared/youtube/metadata'
import type { YoutubeAccountInfo } from '@shared/youtube/accounts'
import { errMsg } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import Button from '@/ui/Button'
import Checkbox from '@/ui/Checkbox'
import Notice from '@/ui/Notice'
import Select from '@/ui/Select'

const PRIVACY: { value: Privacy; label: string }[] = [
  { value: 'private', label: 'Pribadi' },
  { value: 'unlisted', label: 'Tidak terdaftar' },
  { value: 'public', label: 'Publik' }
]

interface Props {
  result: ModeRunResult
  onOpenQueue: () => void
  onOpenAccounts: () => void
}

/** Masukkan video hasil ke antrean upload YouTube. Berlaku untuk semua mode produksi. */
export default function PublishPanel({ result, onOpenQueue, onOpenAccounts }: Props) {
  const [accounts, setAccounts] = useState<YoutubeAccountInfo[] | null>(null)
  const [channelId, setChannelId] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('private')
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
      const r = await window.youfarm.modes.enqueue({ jobId: result.jobId, channelId, privacy, schedule })
      setQueued({ publishAt: r.publishAt })
      toast.success('Video dimasukkan ke antrean upload.')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

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
        hint="Slot 07.00, 12.00, dan 19.00 waktu lokal. Video diunggah sebagai pribadi lalu tayang otomatis."
        checked={schedule}
        onChange={(e) => setSchedule(e.target.checked)}
      />
      <div>
        <Button disabled={!channelId || busy} onClick={() => void submit()}>
          {busy ? 'Memasukkan…' : 'Masukkan ke antrean upload'}
        </Button>
      </div>
    </div>
  )
}
