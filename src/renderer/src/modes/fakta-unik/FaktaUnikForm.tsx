import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { MAX_BATCH, splitTopics } from '@shared/production'
import { TARGET_SECONDS, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { TEXT_PROVIDERS } from '@shared/settings'
import { DEEPGRAM_VOICES, GEMINI_VOICES, LANGUAGE_LIST, languageInfo, voiceSourceSupports, type LanguageCode, type VoiceOption, type VoiceSource } from '@shared/languages'
import type { SecretStatus } from '@shared/settings'
import { STOCK_INFO, STOCK_SOURCES } from '@shared/stock'
import type { VoiceCatalog } from '@shared/ipc-channels'
import CaptionEditor from '@/components/CaptionEditor'
import ModelSelect from '@/components/ModelSelect'
import TopicSuggestions from '@/components/TopicSuggestions'
import { useModelList } from '@/hooks/useModelList'
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

export type FormTab = 'konten' | 'suara' | 'caption'

interface Props {
  opts: FaktaUnikOptions
  setOpts: Dispatch<SetStateAction<FaktaUnikOptions>>
  tab: FormTab
  onTab: (tab: FormTab) => void
  /** Dipanggil setelah video masuk antrean produksi, dengan id job-nya. */
  onQueued: (ids: number[]) => void
  onOpenSettings: () => void
  onOpenQueue: () => void
  onOpenAccounts: () => void
}

const VOICE_HINT: Record<VoiceSource, string> = {
  piper: 'Gratis dan berjalan offline, kualitas sedang.',
  'gemini-tts': 'Paling natural untuk bahasa Indonesia dan banyak bahasa lain. Memakai kuota Gemini.',
  deepgram: 'Natural untuk Inggris, Spanyol, Jerman, Prancis, Belanda, Italia, dan Jepang. Berbayar per karakter.',
  elevenlabs: 'Suara paling hidup, mendukung Indonesia dan hampir semua bahasa lain. Paket gratis tidak boleh untuk konten komersial.'
}

/** Penulis naskah belum siap: alasan singkat, atau null bila siap. */
function textWriterIssue(opts: FaktaUnikOptions, status: SecretStatus): string | null {
  const name = opts.textProvider === 'groq' ? 'Groq' : 'Gemini'
  if (!status[opts.textProvider]) return `Isi key ${name}.`
  return opts.textModel ? null : `Pilih model ${name} untuk naskah.`
}

/** Panel input mode Fakta Unik: tab Konten, Suara, dan Caption. Isian bertahan saat pindah menu. */
export default function FaktaUnikForm({ opts, setOpts, tab, onTab, onQueued, onOpenSettings, onOpenQueue, onOpenAccounts }: Props) {
  const { settings, status } = useSettings()
  const [voices, setVoices] = useState<VoiceCatalog | null>(null)
  const [publish, setPublish] = useStickyState<AutoPublishState>('fakta-unik:auto-publish', DEFAULT_AUTO_PUBLISH)
  const [queueing, setQueueing] = useState(false)
  const set = <K extends keyof FaktaUnikOptions>(k: K, v: FaktaUnikOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  useEffect(() => {
    void window.youfarm?.modes.voices().then(setVoices)
  }, [])

  // Suara ElevenLabs berbeda tiap akun, jadi daftarnya diambil dari API begitu sumber ini dipilih.
  const [elevenVoices, setElevenVoices] = useState<VoiceOption[]>([])
  const [elevenError, setElevenError] = useState<string | null>(null)
  const elevenReady = opts.voiceSource === 'elevenlabs' && Boolean(status?.elevenlabs)
  useEffect(() => {
    if (!elevenReady) return
    let live = true
    setElevenError(null)
    window.youfarm.ai.elevenlabsVoices().then(
      (list) => live && setElevenVoices(list),
      (e) => live && setElevenError(errMsg(e, 'Gagal memuat suara ElevenLabs.'))
    )
    return () => {
      live = false
    }
  }, [elevenReady, status?.elevenlabs])

  const lang = languageInfo(opts.language)
  const piperLangs = useMemo(() => [...new Set((voices?.piper ?? []).map((v) => v.lang))], [voices])
  const supports = (src: VoiceSource, code: string = opts.language): boolean => voiceSourceSupports(src, code, piperLangs)

  const voiceChoices = useMemo(() => {
    if (opts.voiceSource === 'gemini-tts') return GEMINI_VOICES
    if (opts.voiceSource === 'deepgram') return DEEPGRAM_VOICES[opts.language] ?? []
    if (opts.voiceSource === 'elevenlabs') return elevenVoices
    return (voices?.piper ?? []).filter((v) => v.lang === opts.language).map((v) => ({ id: v.name, label: v.name }))
  }, [opts.voiceSource, opts.language, voices, elevenVoices])

  const writerIssue = status ? textWriterIssue(opts, status) : null

  // Daftar model diambil dari API penyedia yang dipilih di form ini (bukan dari Settings).
  const usesGemini = opts.textProvider === 'gemini' || opts.voiceSource === 'gemini-tts'
  const gemini = useModelList('gemini', Boolean(status?.gemini) && usesGemini)
  const groq = useModelList('groq', Boolean(status?.groq) && opts.textProvider === 'groq')
  const writer = opts.textProvider === 'groq' ? groq : gemini

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
      else if (!opts.ttsModel) out.push('Pilih model Gemini untuk suara (TTS).')
    } else if (opts.voiceSource === 'deepgram' && !status.deepgram) out.push('Isi key Deepgram (untuk suara).')
    else if (opts.voiceSource === 'elevenlabs' && !status.elevenlabs) out.push('Isi key ElevenLabs (untuk suara).')
    return out
  }, [settings, status, voices, writerIssue, opts.ttsModel, opts.voiceSource, opts.stockSource, opts.language, piperLangs, lang.label])

  const loaded = Boolean(settings && status && voices)
  const topics = useMemo(() => splitTopics(opts.topic), [opts.topic])
  const short = topics.filter((t) => t.length < 3).length
  const valid = topics.length > 0 && short === 0 && topics.length <= MAX_BATCH
  const canRun = loaded && issues.length === 0 && valid
  const label = topics.length > 1 ? `Buat ${topics.length} video` : 'Buat video'

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

  /** Setiap video, satu atau banyak, masuk antrean produksi dengan salinan pengaturan saat ini. */
  const enqueue = async (): Promise<void> => {
    setQueueing(true)
    try {
      const ids = await window.youfarm.production.enqueue({ mode: 'fakta-unik', options: topics.map((topic) => ({ ...opts, topic })), publish: toPlan(publish) })
      refreshQueues()
      toast.success(ids.length === 1 ? 'Video masuk antrean produksi.' : `${ids.length} video masuk antrean produksi.`, { action: { label: 'Lihat antrean', onClick: onOpenQueue } })
      setOpts((o) => ({ ...o, topic: '' }))
      onQueued(ids)
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
          onChange={onTab}
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
          <Button className="w-full" disabled={!canRun || queueing} onClick={() => void enqueue()}>
            {queueing ? 'Memasukkan…' : label}
          </Button>
        </div>
      }
    >
      {tab === 'konten' && (
        <div className="grid gap-4">
          <TextArea
            label="Topik"
            aside={topics.length > 1 ? `${topics.length} video` : undefined}
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
                  : topics.length > 1
                    ? 'Semua topik memakai pengaturan yang sama dan dibuat satu per satu.'
                    : undefined
            }
          />

          <TopicSuggestions
            mode="fakta-unik"
            language={opts.language}
            current={topics}
            textProvider={opts.textProvider}
            textModel={opts.textModel}
            disabledReason={writerIssue ? `${writerIssue.replace(/\.$/, '')} untuk memakai saran topik.` : null}
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

          <div className="grid gap-2">
            <Segmented
              label="Penulis naskah"
              value={opts.textProvider}
              onChange={(v) => setOpts((o) => ({ ...o, textProvider: v, textModel: '' }))}
              options={TEXT_PROVIDERS.map((p) => ({ value: p, label: p === 'groq' ? 'Groq' : 'Gemini', disabled: status ? !status[p] : false, title: status && !status[p] ? `Isi key ${p === 'groq' ? 'Groq' : 'Gemini'} dulu di Settings > API` : undefined }))}
            />
            <ModelSelect
              label="Model naskah"
              value={opts.textModel}
              options={writer.text}
              loading={writer.loading}
              error={writer.error}
              blockedReason={status && !status[opts.textProvider] ? `Isi key ${opts.textProvider === 'groq' ? 'Groq' : 'Gemini'} di Settings > API untuk memuat model.` : null}
              onChange={(m) => set('textModel', m)}
              onReload={() => void writer.reload()}
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
                  { value: 'deepgram', label: 'Deepgram', title: supports('deepgram') ? undefined : `Deepgram belum punya suara ${lang.label}` },
                  { value: 'elevenlabs', label: 'ElevenLabs', title: supports('elevenlabs') ? undefined : `ElevenLabs belum mendukung ${lang.label}` }
                ] satisfies { value: VoiceSource; label: string; title?: string }[]
              ).map((o) => ({ ...o, disabled: !supports(o.value) }))}
            />
            <p className="text-xs text-ink-muted">{VOICE_HINT[opts.voiceSource]}</p>
          </div>

          <Select label="Suara" value={opts.voiceName} onChange={(e) => set('voiceName', e.target.value)} disabled={voiceChoices.length === 0}>
            <option value="">{opts.voiceSource === 'elevenlabs' ? 'Suara pertama di akun' : 'Bawaan'}</option>
            {voiceChoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
          {opts.voiceSource === 'gemini-tts' && (
            <ModelSelect
              label="Model suara Gemini"
              value={opts.ttsModel}
              options={gemini.tts}
              loading={gemini.loading}
              error={gemini.error}
              blockedReason={status && !status.gemini ? 'Isi key Gemini di Settings > API untuk memuat model.' : null}
              onChange={(m) => set('ttsModel', m)}
              onReload={() => void gemini.reload()}
            />
          )}
          {opts.voiceSource === 'gemini-tts' && <p className="-mt-2 text-xs text-ink-muted">Model Flash punya jatah gratis; model Pro tidak. Satu video memakai satu permintaan suara.</p>}
          {opts.voiceSource === 'elevenlabs' && (
            <p className="text-xs text-ink-muted">{elevenError ?? (elevenReady ? 'Daftar suara diambil dari akun ElevenLabs Anda. Suara dari Voice Library butuh paket berbayar.' : 'Isi key ElevenLabs di Settings > API untuk memuat suara.')}</p>
          )}
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
