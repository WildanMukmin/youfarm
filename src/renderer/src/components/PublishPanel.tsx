import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ASPECT_INFO } from '@shared/contracts/modes'
import { disclosureFor } from '@shared/contracts/modes'
import { mediaUrl } from '@shared/media'
import type { ProductionDetail } from '@shared/production'
import { DESCRIPTION_MAX_BYTES, TITLE_MAX, composeDescription, type Privacy } from '@shared/youtube/metadata'
import type { YoutubeAccountInfo } from '@shared/youtube/accounts'
import { errMsg } from '@/lib/errors'
import { formatClock, formatDateTime, formatDuration, formatSlot } from '@/lib/format'
import { upcomingSlots } from '@/lib/slots'
import { refreshQueues, useQueue } from '@/hooks/useQueue'
import Button from '@/ui/Button'
import Checkbox from '@/ui/Checkbox'
import Field from '@/ui/Field'
import Notice from '@/ui/Notice'
import Select from '@/ui/Select'
import TextArea from '@/ui/TextArea'

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
  // Isi yang akan diunggah, bisa disunting. Deskripsi awal sudah memuat kredit footage dan hashtag.
  const [title, setTitle] = useState(result.video.title)
  const [description, setDescription] = useState(() => composeDescription({ description: result.description, credits: result.video.credits, tags: result.tags }))
  const [tagText, setTagText] = useState(result.tags.join(', '))
  const [thumb, setThumb] = useState<string | null>(null)
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
      const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean)
      const r = await window.youfarm.production.publish({ id: result.id, channelId, privacy, schedule, title, description, tags, customThumbnail: thumb !== null })
      setQueued({ publishAt: r.publishAt })
      refreshQueues()
      toast.success('Video dimasukkan ke antrean upload.')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const pickThumb = async (): Promise<void> => {
    try {
      const url = await window.youfarm.production.pickThumbnail(result.id)
      if (url) setThumb(url)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memilih thumbnail.'))
    }
  }

  const { width, height } = ASPECT_INFO[result.video.aspect]
  const flags = disclosureFor(result.video.mode, result.video.syntheticMedia)
  const channel = accounts?.find((a) => a.channel.id === channelId)
  const nextSlot = channel ? upcomingSlots(channel.slots, snapshot?.items ?? [], channel.channel.id, 1)[0] : undefined

  const descBytes = new TextEncoder().encode(description).length
  const thumbSrc = thumb ?? (result.video.hasThumbnail ? mediaUrl(result.id, 'thumb') : null)

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span className="text-xs text-ink-muted">Thumbnail</span>
        <div className="flex items-end gap-3">
          <div
            className="grid shrink-0 place-items-center overflow-hidden rounded-sm border border-line-hi bg-panel-2"
            style={{ aspectRatio: `${width} / ${height}`, height: 112, maxWidth: '100%' }}
          >
            {thumbSrc ? <img src={thumbSrc} alt="Thumbnail yang akan diunggah" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[11px] text-ink-muted">Tanpa thumbnail</span>}
          </div>
          <div className="grid min-w-0 gap-1.5">
            <p className="font-mono text-[11px] text-ink-muted">
              {formatDuration(result.video.durationSec)} · {result.video.aspect}
            </p>
            <Button variant="ghost" size="sm" onClick={() => void pickThumb()}>
              Ganti…
            </Button>
            {thumb && (
              <button className="justify-self-start text-xs text-crimson-hi underline underline-offset-2" onClick={() => setThumb(null)}>
                Pakai bawaan
              </button>
            )}
          </div>
        </div>
      </div>
      <Field label={`Judul · ${[...title].length}/${TITLE_MAX}`} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
      <TextArea
        label="Deskripsi"
        aside={`${descBytes}/${DESCRIPTION_MAX_BYTES}`}
        value={description}
        rows={7}
        onChange={(e) => setDescription(e.target.value)}
        hint={descBytes > DESCRIPTION_MAX_BYTES ? 'Terlalu panjang; kelebihannya dipotong saat diunggah.' : undefined}
        className="min-h-[140px]"
      />
      <Field label="Tag (pisahkan dengan koma)" value={tagText} onChange={(e) => setTagText(e.target.value)} />
      <div className="grid gap-4">
        <Select label="Channel tujuan" value={channelId} onChange={(e) => setChannelId(e.target.value)} disabled={!accounts}>
          {(accounts ?? []).map((a) => (
            <option key={a.channel.id} value={a.channel.id}>
              {a.channel.title}
            </option>
          ))}
        </Select>
        <Select label="Visibilitas" value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)} disabled={schedule}>
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
      <p className="text-[11px] text-ink-muted">
        {flags.containsSyntheticMedia ? 'Ditandai konten sintetis' : 'Tanpa tanda konten sintetis'} · {flags.madeForKids ? 'Dibuat untuk anak' : 'Bukan untuk anak'} · Bahasa {result.video.language.toUpperCase()}
      </p>
      <div>
        <Button disabled={!channelId || !title.trim() || busy} onClick={() => void submit()}>
          {busy ? 'Memasukkan…' : 'Masukkan ke antrean upload'}
        </Button>
      </div>
    </div>
  )
}
