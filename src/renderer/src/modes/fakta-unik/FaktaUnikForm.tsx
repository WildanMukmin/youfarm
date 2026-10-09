import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { MAX_BATCH, splitTopics } from '@shared/production'
import { TARGET_SECONDS, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { DEEPGRAM_VOICES, GEMINI_VOICES, LANGUAGE_LIST, languageInfo, voiceSourceSupports, type LanguageCode, type VoiceSource } from '@shared/languages'
import type { SecretStatus, Settings } from '@shared/settings'
import { STOCK_INFO, STOCK_SOURCES } from '@shared/stock'
import type { VoiceCatalog } from '@shared/ipc-channels'
import CaptionEditor from '@/components/CaptionEditor'
import TopicSuggestions from '@/components/TopicSuggestions'
import { useSettings } from '@/hooks/useSettings'
import { useStickyState } from '@/hooks/useStickyState'
import { refreshQueues } from '@/hooks/useQueue'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Notice from '@/ui/Notice'
import Panel from '@/ui/Panel'
import PanelTabs from '@/ui/PanelTabs'
import Segmented from '@/ui/Segmented'
import Select from '@/ui/Select'
import TextArea from '@/ui/TextArea'
import AutoPublish, { DEFAULT_AUTO_PUBLISH, toPlan, type AutoPublishState } from './AutoPublish'

type FormTab = 'konten' | 'suara' | 'caption'

interface Props {
  opts: FaktaUnikOptions
  setOpts: Dispatch<SetStateAction<FaktaUnikOptions>>
  running: boolean
  onSubmit: (options: FaktaUnikOptions) => void
  onOpenSettings: () => void
  onOpenQueue: () => void
  onOpenAccounts: () => void
}

const VOICE_HINT: Record<VoiceSource, string> = {
  piper: 'Gratis dan berjalan offline, kualitas sedang.',
  'gemini-tts': 'Paling natural untuk bahasa Indonesia dan banyak bahasa lain. Memakai kuota Gemini.',
  deepgram: 'Natural untuk Inggris, Spanyol, Jerman, Prancis, Belanda, Italia, dan Jepang. Berbayar per karakter.'
}

/** Penulis naskah belum siap: alasan singkat, atau null bila siap. */
function textWriterIssue(settings: Settings, status: SecretStatus): string | null {
  if (settings.textProvider === 'groq') return !status.groq ? 'Isi key Groq.' : !settings.groqTextModel ? 'Pilih model Groq untuk teks.' : null
  return !status.gemini ? 'Isi key Gemini.' : !settings.geminiTextModel ? 'Pilih model Gemini untuk teks.' : null
}

/** Panel input mode Fakta Unik: tab Konten, Suara, dan Caption. Isian bertahan saat pindah menu. */
export default function FaktaUnikForm({ opts, setOpts, running, onSubmit, onOpenSettings, onOpenQueue, onOpenAccounts }: Props) {
  const { settings, status } = useSettings()
  const [tab, setTab] = useStickyState<FormTab>('fakta-unik:tab', 'konten')
  const [voices, setVoices] = useState<VoiceCatalog | null>(null)
  const [publish, setPublish] = useStickyState<AutoPublishState>('fakta-unik:auto-publish', DEFAULT_AUTO_PUBLISH)
  const [queueing, setQueueing] = useState(false)
  const set = <K extends keyof FaktaUnikOptions>(k: K, v: FaktaUnikOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  useEffect(() => {
    void window.youfarm?.modes.voices().then(setVoices)
  }, [])

  const lang = languageInfo(opts.language)
  const piperLangs = useMemo(() => [...new Set((voices?.piper ?? []).map((v) => v.lang))], [voices])
  const supports = (src: VoiceSource, code: string = opts.language): boolean => voiceSourceSupports(src, code, piperLangs)

  const voiceChoices = useMemo(() => {
    if (opts.voiceSource === 'gemini-tts') return GEMINI_VOICES
    if (opts.voiceSource === 'deepgram') return DEEPGRAM_VOICES[opts.language] ?? []
    return (voices?.piper ?? []).filter((v) => v.lang === opts.language).map((v) => ({ id: v.name, label: v.name }))
  }, [opts.voiceSource, opts.language, voices])

  const writerIssue = settings && status ? textWriterIssue(settings, status) : null

  // Yang masih harus disiapkan sebelum video bisa dibuat.
  const issues = useMemo(() => {
    if (!settings || !status || !voices) return []
    const out: string[] = []
    if (writerIssue) out.push(writerIssue)
    const stock = STOCK_INFO[opts.stockSource]
    if (!status[stock.key]) out.push(`Isi key ${stock.label} (untuk footage).`)
    if (!voiceSourceSupports(opts.voiceSource, opts.language, piperLangs)) out.push(`Sumber suara ini belum mendukung bahasa ${lang.label}. Pilih sumber lain di tab Suara.`)
    else if (opts.voiceSource === 'gemini-tts') {
      if (!status.gemini) out.push('Isi key Gemini (untuk suara).')
      else if (!settings.geminiTtsModel) out.push('Pilih model Gemini untuk suara (TTS).')
    } else if (opts.voiceSource === 'deepgram' && !status.deepgram) out.push('Isi key Deepgram (untuk suara).')
    return out
  }, [settings, status, voices, writerIssue, opts.voiceSource, opts.stockSource, opts.language, piperLangs, lang.label])

  const loaded = Boolean(settings && status && voices)
  const topics = useMemo(() => splitTopics(opts.topic), [opts.topic])
  const short = topics.filter((t) => t.length < 3).length
  const valid = topics.length > 0 && short === 0 && topics.length <= MAX_BATCH
  const canRun = loaded && issues.length === 0 && valid
  const batch = topics.length > 1

  const changeLanguage = (code: LanguageCode): void =>
    setOpts((o) => ({
      ...o,
      language: code,
      voiceName: '',
      // Sumber suara yang tidak bisa membacakan bahasa baru diganti Gemini TTS (mendukung semua bahasa).
      voiceSource: voiceSourceSupports(o.voiceSource, code, piperLangs) ? o.voiceSource : 'gemini-tts'
    }))

  const addTopics = (list: string[]): void =>
    setOpts((o) => {
      const lines = o.topic.split('\n').map((l) => l.trim()).filter(Boolean)
      const have = new Set(lines.map((l) => l.toLowerCase()))
      return { ...o, topic: [...lines, ...list.filter((t) => !have.has(t.toLowerCase()))].join('\n') }
    })

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

  return (
    <Panel
      title={
        <PanelTabs
          label="Pengaturan video"
          tabs={[
            { id: 'konten', label: 'Konten' },
            { id: 'suara', label: 'Suara' },
            { id: 'caption', label: 'Caption' }
          ]}
          active={tab}
          onChange={setTab}
        />
      }
      footer={
        <div className="grid gap-3">
          {issues.length > 0 && (
            <Notice tone="warn" title="Perlu disiapkan dulu">
              <ul className="list-disc space-y-0.5 pl-4">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <button className="mt-2 text-crimson-hi underline underline-offset-2" onClick={onOpenSettings}>
                Buka Settings
              </button>
            </Notice>
          )}
          {batch ? (
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
          )}
        </div>
      }
    >
      {tab === 'konten' && (
        <div className="grid gap-4">
          <TextArea
            label="Topik"
            aside={batch ? `${topics.length} video` : undefined}
            value={opts.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder={'Contoh: fakta aneh laut dalam\nSatu topik per baris untuk membuat banyak video sekaligus.'}
            maxLength={8000}
            rows={3}
            hint={
              topics.length > MAX_BATCH
                ? `Maksimal ${MAX_BATCH} topik sekali antre.`
                : short
                  ? 'Tiap topik minimal 3 karakter.'
                  : batch
                    ? 'Semua topik memakai pengaturan yang sama dan dibuat di latar lewat antrean produksi.'
                    : undefined
            }
          />

          <TopicSuggestions
            mode="fakta-unik"
            language={opts.language}
            current={topics}
            disabledReason={writerIssue ? `${writerIssue.replace(/\.$/, '')} di Settings > API untuk memakai saran topik.` : null}
            onAdd={addTopics}
          />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <Select label="Bahasa" value={opts.language} onChange={(e) => changeLanguage(e.target.value as LanguageCode)}>
              {LANGUAGE_LIST.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Segmented
              label="Durasi"
              value={String(opts.targetSec) as `${(typeof TARGET_SECONDS)[number]}`}
              onChange={(v) => set('targetSec', Number(v) as FaktaUnikOptions['targetSec'])}
              options={TARGET_SECONDS.map((s) => ({ value: String(s) as `${typeof s}`, label: `${s}s` }))}
            />
          </div>

          <div className="grid gap-1.5">
            <Segmented
              label="Sumber footage"
              value={opts.stockSource}
              onChange={(v) => set('stockSource', v)}
              options={STOCK_SOURCES.map((s) => ({ value: s, label: STOCK_INFO[s].label }))}
            />
            <p className="text-xs text-ink-muted">Gratis dengan key sendiri. Kredit sumber ditambahkan ke deskripsi video.</p>
          </div>

          <AutoPublish value={publish} onChange={setPublish} onOpenAccounts={onOpenAccounts} />
        </div>
      )}

      {tab === 'suara' && (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Segmented<VoiceSource>
              label={`Sumber suara · ${lang.label}`}
              value={opts.voiceSource}
              onChange={(v) => setOpts((o) => ({ ...o, voiceSource: v, voiceName: '' }))}
              options={(
                [
                  { value: 'piper', label: 'Piper', title: supports('piper') ? 'Lokal, offline' : `Belum ada suara Piper ${lang.label}` },
                  { value: 'gemini-tts', label: 'Gemini TTS' },
                  { value: 'deepgram', label: 'Deepgram', title: supports('deepgram') ? undefined : `Deepgram belum punya suara ${lang.label}` }
                ] satisfies { value: VoiceSource; label: string; title?: string }[]
              ).map((o) => ({ ...o, disabled: !supports(o.value) }))}
            />
            <p className="text-xs text-ink-muted">{VOICE_HINT[opts.voiceSource]}</p>
          </div>

          <Select label="Suara" value={opts.voiceName} onChange={(e) => set('voiceName', e.target.value)} disabled={voiceChoices.length === 0}>
            <option value="">Bawaan</option>
            {voiceChoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
          {opts.voiceSource === 'gemini-tts' && <p className="text-xs text-ink-muted">Bahasa dibaca otomatis dari naskah, jadi semua suara Gemini bisa dipakai untuk bahasa apa pun.</p>}
        </div>
      )}

      {tab === 'caption' && (
        <div className="grid gap-4">
          <p className="text-xs text-ink-muted">Pratinjau di tengah mengikuti pengaturan ini. Waktu sorot tiap kata diperkirakan dari panjang katanya.</p>
          <CaptionEditor value={opts.caption} onChange={(caption) => set('caption', caption)} />
        </div>
      )}
    </Panel>
  )
}
