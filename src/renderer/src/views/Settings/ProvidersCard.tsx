import { useState } from 'react'
import { toast } from 'sonner'
import { isProviderAvailable, splitGeminiModels, type SecretStatus, type Settings } from '@shared/settings'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import Field from '@/ui/Field'
import Segmented from '@/ui/Segmented'
import Select from '@/ui/Select'

interface Props {
  settings: Settings
  status: SecretStatus
  onUpdate: (patch: Partial<Settings>) => void
}

const NEED_KEY = (name: string) => `Isi key ${name} dulu`

/** Pilihan model: daftar dari API, ditambah nilai tersimpan bila belum ada di daftar. */
function withCurrent(list: string[], current: string): string[] {
  return current && !list.includes(current) ? [current, ...list] : list
}

interface ModelPickerProps {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}

function ModelPicker({ label, value, options, onChange }: ModelPickerProps) {
  return options.length > 0 ? (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pilih model…</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </Select>
  ) : (
    <Field label={label} value={value} placeholder="Ketik nama model, atau muat daftarnya" onChange={(e) => onChange(e.target.value)} />
  )
}

export default function ProvidersCard({ settings, status, onUpdate }: Props) {
  const [models, setModels] = useState<{ text: string[]; tts: string[] }>({ text: [], tts: [] })
  const [loading, setLoading] = useState(false)

  const loadModels = async () => {
    setLoading(true)
    try {
      const list = splitGeminiModels(await window.youfarm.ai.geminiModels())
      setModels(list)
      if (list.text.length === 0) toast.error('Tidak ada model yang cocok untuk key ini.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat model.'))
    } finally {
      setLoading(false)
    }
  }

  const geminiOk = isProviderAvailable('gemini', status)
  const groqOk = isProviderAvailable('groq', status)
  const providerNote =
    settings.textProvider === 'groq'
      ? 'Groq belum dipakai mode apa pun; naskah Fakta Unik memakai Gemini.'
      : !geminiOk
        ? NEED_KEY('Gemini')
        : !groqOk
          ? 'Groq bisa dipilih setelah key Groq diisi.'
          : null

  return (
    <Card title="Penyedia AI" description="Provider cloud hanya bisa dipilih bila key-nya sudah diisi.">
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Segmented
            label="Provider teks"
            value={settings.textProvider}
            onChange={(textProvider) => onUpdate({ textProvider })}
            options={[
              { value: 'gemini', label: 'Gemini', disabled: !geminiOk, title: geminiOk ? undefined : NEED_KEY('Gemini') },
              { value: 'groq', label: 'Groq', disabled: !groqOk, title: groqOk ? undefined : NEED_KEY('Groq') }
            ]}
          />
          {providerNote && <p className="text-xs text-ink-muted">{providerNote}</p>}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">Model Gemini</span>
            <Button size="sm" variant="ghost" disabled={!status.gemini || loading} onClick={() => void loadModels()}>
              {loading ? 'Memuat…' : 'Muat daftar model'}
            </Button>
          </div>
          <ModelPicker label="Untuk naskah (teks)" value={settings.geminiTextModel} options={withCurrent(models.text, settings.geminiTextModel)} onChange={(v) => onUpdate({ geminiTextModel: v })} />
          <ModelPicker label="Untuk suara (TTS)" value={settings.geminiTtsModel} options={withCurrent(models.tts, settings.geminiTtsModel)} onChange={(v) => onUpdate({ geminiTtsModel: v })} />
        </div>
      </div>
    </Card>
  )
}
