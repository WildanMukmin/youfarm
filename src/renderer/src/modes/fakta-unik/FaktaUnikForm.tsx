import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { MAX_BATCH, splitTopics } from '@shared/production'
import type { AspectRatio } from '@shared/contracts/modes'
import { DEFAULT_OPTIONS, MIN_HOOK_SEC, MIN_TARGET_SEC, SHORTS_MAX_SEC, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { TEXT_PROVIDERS } from '@shared/settings'
import { DEEPGRAM_VOICES, GEMINI_VOICES, LANGUAGE_LIST, languageInfo, voiceSourceSupports, type LanguageCode, type VoiceOption, type VoiceSource } from '@shared/languages'
import type { SecretStatus } from '@shared/settings'
import { STOCK_INFO, STOCK_SOURCES } from '@shared/stock'
import type { VoiceCatalog } from '@shared/ipc-channels'
import AspectPicker from '@/components/AspectPicker'
import CaptionEditor from '@/components/CaptionEditor'
import ModelSelect from '@/components/ModelSelect'
import TopicComposer from '@/components/TopicComposer'
import { useModelList } from '@/hooks/useModelList'
import { useSettings } from '@/hooks/useSettings'
import { useStickyState } from '@/hooks/useStickyState'
import { refreshQueues } from '@/hooks/useQueue'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Checkbox from '@/ui/Checkbox'
import Field from '@/ui/Field'
import Notice from '@/ui/Notice'
import Panel from '@/ui/Panel'
import PanelTabs from '@/ui/PanelTabs'
import Segmented from '@/ui/Segmented'
import Select from '@/ui/Select'
import AutoPublish, { DEFAULT_AUTO_PUBLISH, toPlan, type AutoPublishState } from './AutoPublish'

export type FormTab = 'konten' | 'suara' | 'caption'

interface Props {
  opts: FaktaUnikOptions
  setOpts: Dispatch<SetStateAction<FaktaUnikOptions>>
  tab: FormTab
  onTab: (tab: FormTab) => void
  /** Format ekspor yang dicentang (minimal satu). Dipegang ruang kerja supaya pratinjau tengah ikut. */
  aspects: AspectRatio[]
  onAspects: (next: AspectRatio[]) => void
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
export default function FaktaUnikForm({ opts, setOpts, tab, onTab, aspects, onAspects, onQueued, onOpenSettings, onOpenQueue, onOpenAccounts }: Props) {
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
  const batch = topics.length * aspects.length
  const valid = topics.length > 0 && short === 0 && aspects.length > 0 && batch <= MAX_BATCH
  const canRun = loaded && issues.length === 0 && valid
  const label = batch > 1 ? `Buat ${batch} video` : 'Buat video'


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

  /** Tiap topik × tiap format dicentang masuk antrean produksi sebagai video sendiri, dengan salinan pengaturan saat ini. */
  const enqueue = async (): Promise<void> => {
    setQueueing(true)
    try {
      const combos = topics.flatMap((topic) => aspects.map((aspect) => ({ ...opts, topic, aspect })))
      const ids = await window.youfarm.production.enqueue({ mode: 'fakta-unik', options: combos, publish: toPlan(publish) })
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
          <TopicComposer
            mode="fakta-unik"
            language={opts.language}
            textProvider={opts.textProvider}
            textModel={opts.textModel}
            value={opts.topic}
            onChange={(topic) => set('topic', topic)}
            count={topics.length}
            disabledReason={writerIssue ? `${writerIssue.replace(/\.$/, '')} untuk meminta AI memilihkan topik.` : null}
            invalid={batch > MAX_BATCH || short > 0}
            hint={
              batch > MAX_BATCH
                ? `Maksimal ${MAX_BATCH} video sekali antre (topik × format).`
                : short
                  ? 'Tiap topik minimal 3 karakter.'
                  : batch > 1
                    ? `${batch} video akan dibuat satu per satu${aspects.length > 1 ? ` (${topics.length} topik × ${aspects.length} format)` : ''}.`
                    : undefined
            }
          />

          <div className="grid grid-cols-[minmax(0,1fr)_104px] items-start gap-3">
            <Select label="Bahasa" value={opts.language} onChange={(e) => changeLanguage(e.target.value as LanguageCode)}>
              {LANGUAGE_LIST.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Field
              label="Durasi (detik)"
              type="number"
              inputMode="numeric"
              min={MIN_TARGET_SEC}
              value={Number.isNaN(opts.targetSec) ? '' : opts.targetSec}
              onChange={(e) => set('targetSec', e.target.valueAsNumber)}
              onBlur={(e) => set('targetSec', Math.max(MIN_TARGET_SEC, Math.round(e.target.valueAsNumber || DEFAULT_OPTIONS.targetSec)))}
            />
          </div>
          {opts.targetSec > SHORTS_MAX_SEC && <p className="-mt-2 text-xs text-ink-muted">Lebih dari 3 menit, video tidak lagi tampil sebagai Shorts di YouTube.</p>}

          <Checkbox
            label="Hook pembuka"
            hint={
              opts.targetSec >= MIN_HOOK_SEC
                ? 'AI menulis satu kalimat pemancing penasaran atau plot twist di depan, tampil sebagai teks besar, lalu isinya menjawab. Gayanya dipilih otomatis.'
                : `Otomatis mati untuk video di bawah ${MIN_HOOK_SEC} detik.`
            }
            checked={opts.hook}
            onChange={(e) => set('hook', e.target.checked)}
          />

          <AspectPicker value={aspects} onChange={onAspects} />

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
