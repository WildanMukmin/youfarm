/**
 * Mode Fakta Unik: preset, opsi, dan bentuk naskah. Murni (tanpa Electron/Node), dipakai form di renderer
 * dan pipeline di main. Mode lain tidak boleh mengimpor file ini.
 */

export const TARGET_SECONDS = [30, 45, 60] as const
export const LANGUAGES = ['id', 'en'] as const
export const VOICE_SOURCES = ['piper', 'gemini-tts'] as const
export const CAPTION_STYLES = ['kuning-tebal', 'putih-bersih', 'kotak-gelap'] as const

export interface FaktaUnikOptions {
  /** Topik atau niche, mis. "fakta aneh tentang laut dalam". */
  topic: string
  language: (typeof LANGUAGES)[number]
  targetSec: (typeof TARGET_SECONDS)[number]
  voiceSource: (typeof VOICE_SOURCES)[number]
  /** Nama suara (Gemini: mis. "Kore"; Piper: nama model). Kosong = bawaan. */
  voiceName: string
  captionStyle: (typeof CAPTION_STYLES)[number]
  /** Topik yang sudah pernah dipakai, supaya tidak berulang. */
  avoid: string[]
}

export const DEFAULT_OPTIONS: FaktaUnikOptions = {
  topic: '',
  language: 'id',
  targetSec: 45,
  voiceSource: 'piper',
  voiceName: '',
  captionStyle: 'kuning-tebal',
  avoid: []
}

export interface ScriptSentence {
  /** Kalimat yang dibacakan. */
  text: string
  /** Kata kunci visual dalam bahasa Inggris (footage stock paling banyak berbahasa Inggris). */
  keywords: string[]
}

export interface FaktaScript {
  title: string
  sentences: ScriptSentence[]
  description: string
  tags: string[]
}

const WORDS_PER_SEC: Record<FaktaUnikOptions['language'], number> = { id: 2.6, en: 2.5 }

export function validateOptions(input: unknown): FaktaUnikOptions {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const topic = typeof o.topic === 'string' ? o.topic.replace(/\s+/g, ' ').trim() : ''
  if (topic.length < 3) throw new Error('Isi topik minimal 3 karakter.')
  if (topic.length > 200) throw new Error('Topik terlalu panjang (maks 200 karakter).')

  const pick = <T extends readonly (string | number)[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
    (list as readonly unknown[]).includes(v) ? (v as T[number]) : fallback

  return {
    topic,
    language: pick(LANGUAGES, o.language, DEFAULT_OPTIONS.language),
    targetSec: pick(TARGET_SECONDS, o.targetSec, DEFAULT_OPTIONS.targetSec),
    voiceSource: pick(VOICE_SOURCES, o.voiceSource, DEFAULT_OPTIONS.voiceSource),
    voiceName: typeof o.voiceName === 'string' ? o.voiceName.trim().slice(0, 80) : '',
    captionStyle: pick(CAPTION_STYLES, o.captionStyle, DEFAULT_OPTIONS.captionStyle),
    avoid: Array.isArray(o.avoid) ? o.avoid.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 50) : []
  }
}

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

/** Perkiraan jumlah kata yang pas untuk durasi target. */
export function targetWords(o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): number {
  return Math.round(WORDS_PER_SEC[o.language] * o.targetSec)
}

const LANG_NAME = { id: 'Bahasa Indonesia', en: 'English' } as const

export function buildScriptPrompt(o: FaktaUnikOptions): { system: string; user: string } {
  const words = targetWords(o)
  const system = [
    'Kamu penulis naskah video pendek vertikal "fakta unik" untuk YouTube Shorts.',
    'Tulis naskah yang akurat, menarik, dan orisinal. Jangan mengarang angka atau klaim yang tidak pasti; bila ragu, pilih fakta lain.',
    'Kalimat pertama adalah hook yang membuat penonton bertahan. Kalimat terakhir menutup dengan kesan kuat, tanpa meminta like atau subscribe.',
    'Keluaran HANYA JSON valid sesuai skema, tanpa teks lain.'
  ].join(' ')

  const avoid = o.avoid.length ? `\nJangan membahas hal yang sudah pernah dipakai: ${o.avoid.map((a) => `"${a}"`).join(', ')}.` : ''
  const user = [
    `Topik: ${o.topic}`,
    `Bahasa naskah: ${LANG_NAME[o.language]}.`,
    `Total sekitar ${words} kata (target ${o.targetSec} detik), dibagi 6 sampai 10 kalimat. Tiap kalimat 6 sampai 22 kata, mudah diucapkan.`,
    'Untuk tiap kalimat beri 2 sampai 3 kata kunci visual dalam bahasa Inggris untuk mencari footage stock: benda atau pemandangan yang konkret dan bisa difilmkan, bukan konsep abstrak.',
    avoid,
    '',
    'Skema JSON:',
    '{"title": string (maks 70 karakter, menarik, tanpa clickbait menyesatkan),',
    ' "sentences": [{"text": string, "keywords": [string]}],',
    ' "description": string (2 sampai 3 kalimat ringkasan, bahasa yang sama dengan naskah),',
    ' "tags": [string] (5 sampai 10 tag)}'
  ]
    .filter((l) => l !== '')
    .join('\n')
  return { system, user }
}

const clean = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/** Validasi ketat keluaran AI. Melempar pesan jelas bila bentuknya tidak bisa dipakai. */
export function parseScript(json: unknown): FaktaScript {
  const j = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  const title = clean(j.title).slice(0, 100)
  if (!title) throw new Error('Naskah dari AI tidak punya judul.')

  const rawSentences = Array.isArray(j.sentences) ? j.sentences : []
  const sentences: ScriptSentence[] = []
  for (const s of rawSentences) {
    const r = (typeof s === 'object' && s !== null ? s : {}) as Record<string, unknown>
    const text = clean(r.text)
    if (!text) continue
    const keywords = (Array.isArray(r.keywords) ? r.keywords : []).map(clean).filter(Boolean).slice(0, 4)
    sentences.push({ text, keywords: keywords.length ? keywords : [title] })
  }
  if (sentences.length < 3) throw new Error('Naskah dari AI terlalu pendek (kurang dari 3 kalimat).')
  if (sentences.length > 14) sentences.length = 14

  const tags = (Array.isArray(j.tags) ? j.tags : []).map(clean).filter(Boolean).slice(0, 12)
  return { title, sentences, description: clean(j.description), tags }
}

/** Naskah dianggap pas bila jumlah katanya dalam ±40% target. Hanya peringatan, bukan penolakan. */
export function scriptLengthWarning(script: FaktaScript, o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): string | null {
  const words = script.sentences.reduce((n, s) => n + wordCount(s.text), 0)
  const target = targetWords(o)
  if (words < target * 0.6) return `Naskah agak pendek (${words} kata, target sekitar ${target}).`
  if (words > target * 1.4) return `Naskah agak panjang (${words} kata, target sekitar ${target}).`
  return null
}

/** Suara bawaan Gemini TTS yang ditawarkan di form (daftar lengkap ada di dokumentasi Gemini). */
export const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Leda', 'Aoede', 'Orus'] as const

/** Kategori YouTube bawaan mode ini (Education). */
export const DEFAULT_CATEGORY_ID = '27'
