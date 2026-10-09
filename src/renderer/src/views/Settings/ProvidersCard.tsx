import { useState, type ReactNode } from 'react'
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

interface ModelSectionProps {
  title: string
  canLoad: boolean
  load: () => Promise<string[]>
  children: (options: string[]) => ReactNode
}

/** Judul bagian, tombol muat daftar model dari API, dan pemilih model di bawahnya. */
function ModelSection({ title, canLoad, load, children }: ModelSectionProps) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const list = await load()
      setModels(list)
      if (list.length === 0) toast.error('Tidak ada model yang cocok untuk key ini.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat model.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">{title}</span>
        <Button size="sm" variant="ghost" disabled={!canLoad || loading} onClick={() => void run()}>
          {loading ? 'Memuat…' : 'Muat daftar model'}
        </Button>
      </div>
      {children(models)}
    </div>
  )
}

export default function ProvidersCard({ settings, status, onUpdate }: Props) {
  const geminiOk = isProviderAvailable('gemini', status)
  const groqOk = isProviderAvailable('groq', status)
  const groq = settings.textProvider === 'groq'
  const providerNote = !geminiOk && !groqOk ? 'Isi key Gemini atau Groq dulu.' : groq ? 'Naskah dan saran topik ditulis Groq. Suara Gemini TTS tetap memakai key Gemini.' : null

  return (
    <Card title="Penyedia AI" description="Provider cloud hanya bisa dipilih bila key-nya sudah diisi.">
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Segmented
            label="Penulis naskah dan saran topik"
            value={settings.textProvider}
            onChange={(textProvider) => onUpdate({ textProvider })}
            options={[
              { value: 'gemini', label: 'Gemini', disabled: !geminiOk, title: geminiOk ? undefined : NEED_KEY('Gemini') },
              { value: 'groq', label: 'Groq', disabled: !groqOk, title: groqOk ? undefined : NEED_KEY('Groq') }
            ]}
          />
          {providerNote && <p className="text-xs text-ink-muted">{providerNote}</p>}
        </div>

        {groq ? (
          <ModelSection title="Model Groq" canLoad={status.groq} load={() => window.youfarm.ai.groqModels()}>
            {(list) => (
              <ModelPicker label="Untuk naskah (teks)" value={settings.groqTextModel} options={withCurrent(list, settings.groqTextModel)} onChange={(v) => onUpdate({ groqTextModel: v })} />
            )}
          </ModelSection>
        ) : null}

        <ModelSection title="Model Gemini" canLoad={status.gemini} load={() => window.youfarm.ai.geminiModels()}>
          {(list) => {
            const split = splitGeminiModels(list)
            return (
              <>
                {!groq && (
                  <ModelPicker label="Untuk naskah (teks)" value={settings.geminiTextModel} options={withCurrent(split.text, settings.geminiTextModel)} onChange={(v) => onUpdate({ geminiTextModel: v })} />
                )}
                <ModelPicker label="Untuk suara (TTS)" value={settings.geminiTtsModel} options={withCurrent(split.tts, settings.geminiTtsModel)} onChange={(v) => onUpdate({ geminiTtsModel: v })} />
              </>
            )
          }}
        </ModelSection>
      </div>
    </Card>
  )
}
