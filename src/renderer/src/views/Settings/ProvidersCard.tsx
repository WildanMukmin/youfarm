import { useState } from 'react'
import { toast } from 'sonner'
import { isProviderAvailable, splitGeminiModels, type SecretStatus, type Settings } from '@shared/settings'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import Field from '@/ui/Field'
import RadioGroup from '@/ui/RadioGroup'
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
    <Field label={label} value={value} placeholder="Muat daftar model, atau ketik nama model" onChange={(e) => onChange(e.target.value)} />
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

  return (
    <Card title="Penyedia AI" description="Provider cloud hanya bisa dipilih bila key-nya sudah diisi.">
      <div className="grid gap-5">
        <RadioGroup
          legend="Provider teks"
          value={settings.textProvider}
          onChange={(textProvider) => onUpdate({ textProvider })}
          options={[
            { value: 'gemini', label: 'Gemini', disabled: !isProviderAvailable('gemini', status), disabledReason: NEED_KEY('Gemini') },
            { value: 'groq', label: 'Groq', hint: 'Belum dipakai mode apa pun', disabled: !isProviderAvailable('groq', status), disabledReason: NEED_KEY('Groq') }
          ]}
        />

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <ModelPicker label="Model Gemini untuk teks" value={settings.geminiTextModel} options={withCurrent(models.text, settings.geminiTextModel)} onChange={(v) => onUpdate({ geminiTextModel: v })} />
          <ModelPicker label="Model Gemini untuk suara (TTS)" value={settings.geminiTtsModel} options={withCurrent(models.tts, settings.geminiTtsModel)} onChange={(v) => onUpdate({ geminiTtsModel: v })} />
          <Button variant="ghost" disabled={!status.gemini || loading} onClick={() => void loadModels()}>
            {loading ? 'Memuat…' : 'Muat daftar model'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
