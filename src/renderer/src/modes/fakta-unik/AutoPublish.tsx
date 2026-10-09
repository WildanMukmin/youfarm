import { useEffect, useState } from 'react'
import type { PublishPlan } from '@shared/production'
import type { YoutubeAccountInfo } from '@shared/youtube/accounts'
import type { Privacy } from '@shared/youtube/metadata'
import { formatClock } from '@/lib/format'
import Checkbox from '@/ui/Checkbox'
import Select from '@/ui/Select'

export interface AutoPublishState {
  enabled: boolean
  channelId: string
  privacy: Privacy
  schedule: boolean
}

export const DEFAULT_AUTO_PUBLISH: AutoPublishState = { enabled: false, channelId: '', privacy: 'public', schedule: true }

/** Rencana publikasi untuk antrean produksi, atau null bila tidak diunggah otomatis / belum lengkap. */
export function toPlan(s: AutoPublishState): PublishPlan | null {
  return s.enabled && s.channelId ? { channelId: s.channelId, privacy: s.privacy, schedule: s.schedule } : null
}

interface Props {
  value: AutoPublishState
  onChange: (v: AutoPublishState) => void
  onOpenAccounts: () => void
}

/** "Setelah selesai": video dari antrean produksi langsung masuk antrean upload ke channel pilihan. */
export default function AutoPublish({ value, onChange, onOpenAccounts }: Props) {
  const [accounts, setAccounts] = useState<YoutubeAccountInfo[] | null>(null)

  useEffect(() => {
    void window.youfarm?.youtube.status().then((s) => setAccounts(s.accounts.filter((a) => a.canUpload)))
  }, [])

  // Channel yang tersimpan sudah tidak terhubung: pilih channel pertama yang ada.
  useEffect(() => {
    if (accounts && accounts.length && !accounts.some((a) => a.channel.id === value.channelId)) onChange({ ...value, channelId: accounts[0].channel.id })
  }, [accounts, value, onChange])

  const channel = accounts?.find((a) => a.channel.id === value.channelId)

  return (
    <div className="grid gap-3 rounded-sm border border-line-hi p-3">
      <Checkbox
        label="Unggah otomatis setelah jadi"
        hint="Berlaku untuk video yang diantrekan. Video langsung masuk antrean upload."
        checked={value.enabled}
        disabled={accounts !== null && accounts.length === 0}
        onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
      />
      {accounts !== null && accounts.length === 0 && (
        <p className="text-xs text-ink-muted">
          Belum ada channel.{' '}
          <button className="text-crimson-hi underline underline-offset-2" onClick={onOpenAccounts}>
            Hubungkan di menu Akun
          </button>
        </p>
      )}
      {value.enabled && accounts && accounts.length > 0 && (
        <>
          <Select label="Channel" value={value.channelId} onChange={(e) => onChange({ ...value, channelId: e.target.value })}>
            {accounts.map((a) => (
              <option key={a.channel.id} value={a.channel.id}>
                {a.channel.title}
              </option>
            ))}
          </Select>
          <Checkbox
            label="Tayang di jam tayang channel"
            hint={channel ? `${channel.slots.map(formatClock).join(', ')} · tayang publik otomatis di jam itu` : undefined}
            checked={value.schedule}
            onChange={(e) => onChange({ ...value, schedule: e.target.checked })}
          />
          {!value.schedule && (
            <Select label="Privasi" value={value.privacy} onChange={(e) => onChange({ ...value, privacy: e.target.value as Privacy })}>
              <option value="public">Publik</option>
              <option value="unlisted">Tidak terdaftar</option>
              <option value="private">Pribadi</option>
            </Select>
          )}
        </>
      )}
    </div>
  )
}
