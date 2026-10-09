import { useState } from 'react'
import { toast } from 'sonner'
import type { SecretKey, SecretStatus } from '@shared/settings'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import Field from '@/ui/Field'
import StatusChip from '@/ui/StatusChip'

const KEYS: { id: SecretKey; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Gemini', hint: 'Naskah, suara, analisis video' },
  { id: 'groq', label: 'Groq', hint: 'Naskah dan transkripsi' },
  { id: 'deepgram', label: 'Deepgram', hint: 'Transkripsi dan suara' },
  { id: 'pexels', label: 'Pexels', hint: 'Footage stock' },
  { id: 'elevenlabs', label: 'ElevenLabs', hint: 'Suara narasi' }
]

interface Props {
  status: SecretStatus
  onChange: (status: SecretStatus) => void
}

/** Baris dua tingkat (nama + status, lalu input + tombol) supaya tetap muat di kartu sempit. */
export default function ApiKeysCard({ status, onChange }: Props) {
  const [drafts, setDrafts] = useState<Partial<Record<SecretKey, string>>>({})

  const save = async (id: SecretKey) => {
    try {
      onChange(await window.youfarm.secrets.set(id, drafts[id] ?? ''))
      setDrafts((d) => ({ ...d, [id]: '' }))
      toast.success('Key disimpan terenkripsi.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal menyimpan key.'))
    }
  }

  const clear = async (id: SecretKey) => {
    onChange(await window.youfarm.secrets.clear(id))
    toast.success('Key dihapus.')
  }

  return (
    <Card title="API key" description="Disimpan terenkripsi di komputer ini. Nilainya tidak pernah ditampilkan lagi.">
      <ul className="grid">
        {KEYS.map(({ id, label, hint }) => {
          const hasDraft = Boolean(drafts[id]?.trim())
          return (
            <li key={id} className="grid gap-2 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-ink-muted">{hint}</div>
                </div>
                <StatusChip tone={status[id] ? 'done' : 'idle'}>{status[id] ? 'Terisi' : 'Kosong'}</StatusChip>
              </div>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Field
                    label={`Key ${label}`}
                    hideLabel
                    type="password"
                    autoComplete="off"
                    value={drafts[id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                    placeholder={status[id] ? 'Ketik key baru untuk mengganti' : 'Tempel key di sini'}
                  />
                </div>
                {hasDraft || !status[id] ? (
                  <Button className="shrink-0" disabled={!hasDraft} onClick={() => void save(id)}>
                    Simpan
                  </Button>
                ) : (
                  <Button className="shrink-0" variant="ghost" onClick={() => void clear(id)}>
                    Hapus
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
