import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MAX_BATCH, splitTopics } from '@shared/production'
import { CAPTION_STYLES, DEFAULT_OPTIONS, GEMINI_VOICES, TARGET_SECONDS, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { isProviderAvailable } from '@shared/settings'
import type { VoiceCatalog } from '@shared/ipc-channels'
import { useSettings } from '@/hooks/useSettings'
import { useStickyState } from '@/hooks/useStickyState'
import { refreshQueues } from '@/hooks/useQueue'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import TextArea from '@/ui/TextArea'
import AutoPublish, { DEFAULT_AUTO_PUBLISH, toPlan, type AutoPublishState } from './AutoPublish'
import Notice from '@/ui/Notice'
import Panel from '@/ui/Panel'
import Segmented from '@/ui/Segmented'
import Select from '@/ui/Select'

interface Props {
  running: boolean
  onSubmit: (options: FaktaUnikOptions) => void
  onOpenSettings: () => void
  onOpenQueue: () => void
  onOpenAccounts: () => void
}

const CAPTION_LABEL: Record<(typeof CAPTION_STYLES)[number], string> = {
  'kuning-tebal': 'Kuning tebal',
  'putih-bersih': 'Putih bersih',
  'kotak-gelap': 'Kotak gelap'
}

/** Panel input mode Fakta Unik. Isian bertahan saat pindah menu. */
export default function FaktaUnikForm({ running, onSubmit, onOpenSettings, onOpenQueue, onOpenAccounts }: Props) {
  const { settings, status } = useSettings()
  const [opts, setOpts] = useStickyState<FaktaUnikOptions>('fakta-unik:form', DEFAULT_OPTIONS)
  const [voices, setVoices] = useState<VoiceCatalog | null>(null)
  const [publish, setPublish] = useStickyState<AutoPublishState>('fakta-unik:auto-publish', DEFAULT_AUTO_PUBLISH)
  const [queueing, setQueueing] = useState(false)
  const set = <K extends keyof FaktaUnikOptions>(k: K, v: FaktaUnikOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  useEffect(() => {
    void window.youfarm?.modes.voices().then(setVoices)
  }, [])

  const piperVoices = useMemo(() => (voices?.piper ?? []).filter((v) => v.lang === opts.language), [voices, opts.language])

  // Yang masih harus disiapkan sebelum video bisa dibuat.
  const issues = useMemo(() => {
    if (!settings || !status || !voices) return []
    const out: string[] = []
    if (!status.gemini) out.push('Isi key Gemini.')
    else if (settings.textProvider !== 'gemini') out.push('Pilih Gemini sebagai provider teks.')
    else if (!settings.geminiTextModel) out.push('Pilih model Gemini untuk teks.')
    if (!status.pexels) out.push('Isi key Pexels (untuk footage).')
    if (opts.voiceSource === 'gemini-tts' && status.gemini && !settings.geminiTtsModel) out.push('Pilih model Gemini untuk suara (TTS).')
    if (opts.voiceSource === 'piper' && piperVoices.length === 0) out.push(`Suara Piper bahasa "${opts.language}" belum terpasang (npm run setup:piper).`)
    return out
  }, [settings, status, voices, opts.voiceSource, opts.language, piperVoices.length])

  const loaded = Boolean(settings && status && voices)
  const topics = useMemo(() => splitTopics(opts.topic), [opts.topic])
  const short = topics.filter((t) => t.length < 3).length
  const valid = topics.length > 0 && short === 0 && topics.length <= MAX_BATCH
  const canRun = loaded && issues.length === 0 && valid
  const batch = topics.length > 1

  /** Masukkan semua topik ke antrean produksi dengan opsi yang sedang dipilih. */
  const enqueue = async (): Promise<void> => {
    setQueueing(true)
    try {
      const ids = await window.youfarm.production.enqueue({ mode: 'fakta-unik', options: topics.map((topic) => ({ ...opts, topic })), publish: toPlan(publish) })
      refreshQueues()
      toast.success(`${ids.length} video masuk antrean produksi.`, { action: { label: 'Lihat', onClick: onOpenQueue } })
      setOpts((o) => ({ ...o, topic: '' }))
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setQueueing(false)
    }
  }
  const voiceChoices = opts.voiceSource === 'piper' ? piperVoices.map((v) => v.name) : [...GEMINI_VOICES]
  const geminiOk = Boolean(status && isProviderAvailable('gemini-tts', status))

  return (
    <Panel
      title="Input"
      footer={
        batch ? (
          <Button className="w-full" disabled={!canRun || queueing} onClick={() => void enqueue()}>
            {queueing ? 'Memasukkan…' : `Antrekan ${topics.length} video`}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!canRun || running} onClick={() => onSubmit({ ...opts, topic: topics[0] ?? '' })}>
              {running ? 'Sedang membuat…' : 'Buat video'}
            </Button>
            <Button variant="ghost" disabled={!canRun || queueing} onClick={() => void enqueue()} title="Buat di latar lewat antrean produksi">
              Antrekan
            </Button>
          </div>
        )
      }
    >
      <div className="grid gap-4">
        <TextArea
          label="Topik atau niche"
          aside={batch ? `${topics.length} video` : undefined}
          value={opts.topic}
          onChange={(e) => set('topic', e.target.value)}
          placeholder={'Contoh: fakta aneh laut dalam\nTulis beberapa topik, satu per baris, untuk membuat banyak video sekaligus.'}
          maxLength={8000}
          rows={3}
          hint={
            topics.length > MAX_BATCH
              ? `Maksimal ${MAX_BATCH} topik sekali antre.`
              : short
                ? 'Tiap topik minimal 3 karakter.'
                : batch
                  ? 'Semua topik memakai opsi di bawah dan dibuat di latar lewat antrean produksi.'
                  : undefined
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <Segmented
            label="Bahasa"
            value={opts.language}
            onChange={(v) => setOpts((o) => ({ ...o, language: v, voiceName: '' }))}
            options={[
              { value: 'id', label: 'ID' },
              { value: 'en', label: 'EN' }
            ]}
          />
          <Segmented
            label="Durasi"
            value={String(opts.targetSec) as `${(typeof TARGET_SECONDS)[number]}`}
            onChange={(v) => set('targetSec', Number(v) as FaktaUnikOptions['targetSec'])}
            options={TARGET_SECONDS.map((s) => ({ value: String(s) as `${typeof s}`, label: `${s}s` }))}
          />
        </div>

        <div className="grid gap-1.5">
          <Segmented
            label="Sumber suara"
            value={opts.voiceSource}
            onChange={(v) => setOpts((o) => ({ ...o, voiceSource: v, voiceName: '' }))}
            options={[
              { value: 'piper', label: 'Piper (lokal)' },
              { value: 'gemini-tts', label: 'Gemini TTS', disabled: !geminiOk, title: geminiOk ? undefined : 'Isi key Gemini dulu' }
            ]}
          />
          <p className="text-xs text-ink-muted">{opts.voiceSource === 'piper' ? 'Gratis dan berjalan offline.' : 'Lebih natural, memakai kuota Gemini.'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Suara" value={opts.voiceName} onChange={(e) => set('voiceName', e.target.value)}>
            <option value="">Bawaan</option>
            {voiceChoices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          <Select label="Gaya caption" value={opts.captionStyle} onChange={(e) => set('captionStyle', e.target.value as FaktaUnikOptions['captionStyle'])}>
            {CAPTION_STYLES.map((c) => (
              <option key={c} value={c}>
                {CAPTION_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>

        <AutoPublish value={publish} onChange={setPublish} onOpenAccounts={onOpenAccounts} />
      </div>

      {issues.length > 0 && (
        <div className="mt-5">
          <Notice tone="warn" title="Perlu disiapkan di Settings > API">
            <ul className="list-disc space-y-0.5 pl-4">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <button className="mt-2 text-crimson-hi underline underline-offset-2" onClick={onOpenSettings}>
              Buka Settings
            </button>
          </Notice>
        </div>
      )}
    </Panel>
  )
}
