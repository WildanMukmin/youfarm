import { useState } from 'react'
import { toast } from 'sonner'
import type { SecretKey, SecretStatus } from '@shared/settings'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import Field from '@/ui/Field'
import StatusChip from '@/ui/StatusChip'

const KEYS: { id: SecretKey; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Gemini', hint: 'Teks, gambar, TTS, analisis' },
  { id: 'groq', label: 'Groq', hint: 'Teks dan transkripsi' },
  { id: 'deepgram', label: 'Deepgram', hint: 'Transkripsi dan suara' },
  { id: 'pexels', label: 'Pexels', hint: 'Footage stock' },
  { id: 'elevenlabs', label: 'ElevenLabs', hint: 'Suara narasi' }
]

interface Props {
  status: SecretStatus
  onChange: (status: SecretStatus) => void
}

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
      <ul className="grid gap-3">
        {KEYS.map(({ id, label, hint }) => {
          const hasDraft = Boolean(drafts[id]?.trim())
          return (
            <li key={id} className="grid grid-cols-[130px_1fr_auto_76px] items-center gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{label}</div>
                <div className="truncate text-xs text-ink-muted" title={hint}>
                  {hint}
                </div>
              </div>
              <Field
                label={`Key ${label}`}
                hideLabel
                type="password"
                autoComplete="off"
                value={drafts[id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                placeholder={status[id] ? '••••••••••••  (ketik untuk mengganti)' : 'Tempel key di sini'}
              />
              <StatusChip tone={status[id] ? 'done' : 'idle'}>{status[id] ? 'Terisi' : 'Kosong'}</StatusChip>
              {hasDraft || !status[id] ? (
                <Button disabled={!hasDraft} onClick={() => void save(id)}>
                  Simpan
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => void clear(id)}>
                  Hapus
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
