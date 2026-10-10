/**
 * Mode Fakta Unik: preset, opsi, dan bentuk naskah. Murni (tanpa Electron/Node), dipakai form di renderer
 * dan pipeline di main. Mode lain tidak boleh mengimpor file ini.
 */

import { ASPECT_RATIOS, type AspectRatio } from '../contracts/modes.ts'
import { CAPTION_TEMPLATES, DEFAULT_CAPTION, sanitizeCaption, type CaptionStyle } from '../captions.ts'
import { LANGUAGE_CODES, VOICE_SOURCES, languageInfo, speechUnits, type LanguageCode, type VoiceSource } from '../languages.ts'
import { TEXT_PROVIDERS, type TextProvider } from '../settings.ts'
import { STOCK_SOURCES } from '../stock.ts'

/** Durasi target bebas (detik). Batas atas hanya pengaman agar prompt dan naskah tidak absurd; form tidak membatasinya. */
export const MIN_TARGET_SEC = 5
export const MAX_TARGET_SEC = 3600
/** Di atas ini video tidak lagi tampil sebagai Shorts di YouTube. */
export const SHORTS_MAX_SEC = 180
/** Video lebih pendek dari ini tanpa hook: pembuka 3 detik terlalu besar porsinya. */
export const MIN_HOOK_SEC = 20

export interface FaktaUnikOptions {
  /** Topik atau niche, mis. "fakta aneh tentang laut dalam". */
  topic: string
  /** Penyedia AI dan model penulis naskah. Model kosong = belum dipilih. */
  textProvider: TextProvider
  textModel: string
  /** Model Gemini untuk suara (dipakai bila sumber suara Gemini TTS). */
  ttsModel: string
  language: LanguageCode
  /** Detik, dijepit ke [MIN_TARGET_SEC, MAX_TARGET_SEC] saat divalidasi. */
  targetSec: number
  voiceSource: VoiceSource
  /** ID suara (Gemini: mis. "Kore"; Deepgram: "aura-2-thalia-en"; Piper: nama model). Kosong = bawaan. */
  voiceName: string
  caption: CaptionStyle
  /** Penyedia footage stock. */
  stockSource: (typeof STOCK_SOURCES)[number]
  /** Format video akhir. Memilih beberapa format di form berarti video ini diulang sekali per format. */
  aspect: AspectRatio
  /** Hook pembuka: kalimat pemancing penasaran sebelum penjelasan, tampil sebagai teks besar. Hanya berlaku bila durasi ≥ MIN_HOOK_SEC. */
  hook: boolean
  /** Topik yang sudah pernah dipakai, supaya tidak berulang. */
  avoid: string[]
}

export const DEFAULT_OPTIONS: FaktaUnikOptions = {
  topic: '',
  textProvider: 'gemini',
  textModel: '',
  ttsModel: '',
  language: 'id',
  targetSec: 45,
  voiceSource: 'piper',
  voiceName: '',
  caption: DEFAULT_CAPTION,
  stockSource: 'pixabay',
  aspect: '9:16',
  hook: true,
  avoid: []
}

/** Hook benar-benar dipakai untuk video ini. */
export const hookEnabled = (o: Pick<FaktaUnikOptions, 'hook' | 'targetSec'>): boolean => o.hook && o.targetSec >= MIN_HOOK_SEC

export interface ScriptSentence {
  /** Kalimat yang dibacakan. */
  text: string
  /** Kata kunci visual dalam bahasa Inggris (footage stock paling banyak berbahasa Inggris). */
  keywords: string[]
}

export interface FaktaScript {
  title: string
  /** Kalimat pembuka pemancing penasaran, terpisah dari `sentences`. Null bila tidak dipakai. */
  hook: string | null
  hookKeywords: string[]
  /** Alasan hook diminta tetapi tidak bisa dipakai (kosong, terlalu panjang, tidak nyambung dengan isi). */
  hookIssue: string | null
  sentences: ScriptSentence[]
  description: string
  tags: string[]
}

/** Antrean lama menyimpan gaya caption sebagai nama preset (`captionStyle`); ubah ke gaya lengkap. */
function captionFrom(o: Record<string, unknown>): CaptionStyle {
  if (typeof o.caption === 'object' && o.caption !== null) return sanitizeCaption(o.caption)
  const legacy = CAPTION_TEMPLATES.find((t) => t.id === o.captionStyle)
  return legacy ? legacy.style : DEFAULT_CAPTION
}

export function validateOptions(input: unknown): FaktaUnikOptions {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const topic = typeof o.topic === 'string' ? o.topic.replace(/\s+/g, ' ').trim() : ''
  if (topic.length < 3) throw new Error('Isi topik minimal 3 karakter.')
  if (topic.length > 200) throw new Error('Topik terlalu panjang (maks 200 karakter).')

  const pick = <T extends readonly (string | number)[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
    (list as readonly unknown[]).includes(v) ? (v as T[number]) : fallback

  // Angka tak valid (string, NaN) kembali ke bawaan; angka di luar rentang dijepit, bukan ditolak.
  const targetSec = (): number => {
    const n = typeof o.targetSec === 'number' ? o.targetSec : Number(o.targetSec)
    if (!Number.isFinite(n)) return DEFAULT_OPTIONS.targetSec
    return Math.min(MAX_TARGET_SEC, Math.max(MIN_TARGET_SEC, Math.round(n)))
  }

  return {
    topic,
    textProvider: pick(TEXT_PROVIDERS, o.textProvider, DEFAULT_OPTIONS.textProvider),
    textModel: typeof o.textModel === 'string' ? o.textModel.trim().slice(0, 100) : '',
    ttsModel: typeof o.ttsModel === 'string' ? o.ttsModel.trim().slice(0, 100) : '',
    language: pick(LANGUAGE_CODES, o.language, DEFAULT_OPTIONS.language),
    targetSec: targetSec(),
    voiceSource: pick(VOICE_SOURCES, o.voiceSource, DEFAULT_OPTIONS.voiceSource),
    voiceName: typeof o.voiceName === 'string' ? o.voiceName.trim().slice(0, 80) : '',
    caption: captionFrom(o),
    stockSource: pick(STOCK_SOURCES, o.stockSource, DEFAULT_OPTIONS.stockSource),
    aspect: pick(ASPECT_RATIOS, o.aspect, DEFAULT_OPTIONS.aspect),
    hook: typeof o.hook === 'boolean' ? o.hook : DEFAULT_OPTIONS.hook,
    avoid: Array.isArray(o.avoid) ? o.avoid.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 50) : []
  }
}

/** Perkiraan panjang naskah yang pas untuk durasi target, dalam satuan bahasanya (kata atau karakter). */
export function targetLength(o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): { amount: number; unit: 'kata' | 'karakter' } {
  const lang = languageInfo(o.language)
  return { amount: Math.round(lang.rate * o.targetSec), unit: lang.unit === 'char' ? 'karakter' : 'kata' }
}

/** Jumlah kalimat yang diminta dari AI; makin panjang durasi, makin banyak kalimat (sekitar satu per 5 sampai 9 detik). */
export function sentenceRange(targetSec: number): { min: number; max: number } {
  return { min: Math.max(6, Math.round(targetSec / 9)), max: Math.max(10, Math.round(targetSec / 5)) }
}

export function buildScriptPrompt(o: FaktaUnikOptions): { system: string; user: string } {
  const withHook = hookEnabled(o)
  const lang = languageInfo(o.language)
  const len = targetLength(o)
  const perSentence = lang.unit === 'char' ? '12 sampai 45 karakter' : '6 sampai 22 kata'
  const { min, max } = sentenceRange(o.targetSec)
  const system = [
    'Kamu penulis naskah video pendek vertikal "fakta unik" untuk YouTube Shorts.',
    'Tulis naskah yang akurat, menarik, dan orisinal. Jangan mengarang angka atau klaim yang tidak pasti; bila ragu, pilih fakta lain.',
    withHook
      ? 'Naskah dibuka dengan "hook" yang terpisah dari isi: satu kalimat pendek yang memancing rasa penasaran atau plot twist tentang fakta ini, tanpa membocorkan jawabannya. Pilih sendiri gaya terkuat: pertanyaan yang bikin penasaran, kontradiksi yang mengejutkan, atau angka yang tidak masuk akal. Hook tidak boleh menyesatkan: isi naskah WAJIB menjawab dan membuktikan hook itu. Isi naskah langsung masuk ke penjelasan dan tidak mengulang hook. Kalimat terakhir isi menutup dengan kesan kuat, tanpa meminta like atau subscribe.'
      : 'Kalimat pertama adalah hook yang membuat penonton bertahan. Kalimat terakhir menutup dengan kesan kuat, tanpa meminta like atau subscribe.',
    `Tulis judul, kalimat naskah, deskripsi, dan tag dalam ${lang.promptName}, dengan gaya bertutur yang alami bagi penutur aslinya.`,
    'Keluaran HANYA JSON valid sesuai skema, tanpa teks lain.'
  ].join(' ')

  const avoid = o.avoid.length ? `\nJangan membahas hal yang sudah pernah dipakai: ${o.avoid.map((a) => `"${a}"`).join(', ')}.` : ''
  const user = [
    `Topik: ${o.topic}`,
    `Bahasa naskah: ${lang.promptName}.`,
    `Total sekitar ${len.amount} ${len.unit} (target ${o.targetSec} detik${withHook ? ', sudah termasuk hook' : ''}), ${withHook ? 'isi dibagi' : 'dibagi'} ${min} sampai ${max} kalimat. Tiap kalimat ${perSentence}, mudah diucapkan.${withHook ? ` Hook maksimal ${lang.unit === 'char' ? '30 karakter' : '12 kata'}.` : ''}`,
    'Untuk tiap kalimat beri 2 sampai 3 kata kunci visual dalam bahasa Inggris untuk mencari footage stock: benda atau pemandangan yang konkret dan bisa difilmkan, bukan konsep abstrak.',
    avoid,
    '',
    `PENTING: title, text, description, dan tags WAJIB ditulis dalam ${lang.promptName}, apa pun bahasa topiknya. Hanya "keywords" yang berbahasa Inggris.`,
    '',
    'Skema JSON:',
    '{"title": string (maks 70 karakter, menarik, tanpa clickbait menyesatkan),',
    ...(withHook ? [' "hook": string (satu kalimat pembuka pemancing penasaran),', ' "hookKeywords": [string] (2 sampai 3 kata kunci visual Inggris untuk footage hook),'] : []),
    ' "sentences": [{"text": string, "keywords": [string]}],',
    ' "description": string (2 sampai 3 kalimat ringkasan, bahasa yang sama dengan naskah),',
    ' "tags": [string] (5 sampai 10 tag)}'
  ]
    .filter((l) => l !== '')
    .join('\n')
  return { system, user }
}

/* ---- Saran topik ---- */

export const SUGGESTION_COUNT = 8

/**
 * Minta AI menyarankan topik Fakta Unik. Dengan `seed` (niche yang diketik pengguna) saran berupa topik spesifik
 * di dalam niche itu; tanpa seed, saran berupa campuran niche yang laku untuk Shorts.
 */
export function buildTopicPrompt(p: { seed: string; language: string; avoid: string[] }): { system: string; user: string } {
  const lang = languageInfo(p.language)
  const seed = p.seed.replace(/\s+/g, ' ').trim().slice(0, 200)
  const system = [
    'Kamu riset konten untuk channel YouTube Shorts "fakta unik" yang dibuat otomatis dari footage stock dan narasi.',
    'Sarankan topik yang membuat penasaran, faktual (bisa diverifikasi), aman untuk iklan, dan mudah divisualkan dengan footage stock umum.',
    'Hindari topik politik, SARA, tragedi baru, kesehatan yang menyesatkan, dan tokoh hidup.',
    'Keluaran HANYA JSON valid sesuai skema, tanpa teks lain.'
  ].join(' ')
  const user = [
    seed ? `Niche: ${seed}. Sarankan ${SUGGESTION_COUNT} topik spesifik di dalam niche ini, masing-masing cukup untuk satu video 30 sampai 60 detik.` : `Sarankan ${SUGGESTION_COUNT} topik dari niche yang beragam dan sedang diminati penonton Shorts.`,
    `Tulis topik dalam ${lang.promptName}, singkat (3 sampai 9 kata), tanpa nomor dan tanpa tanda kutip.`,
    p.avoid.length ? `Jangan mengulang yang sudah dipakai: ${p.avoid.slice(0, 40).map((a) => `"${a}"`).join(', ')}.` : '',
    'Skema JSON: {"topics": [{"topic": string, "why": string (alasan singkat kenapa menarik, maks 12 kata)}]}'
  ]
    .filter(Boolean)
    .join('\n')
  return { system, user }
}

export interface TopicSuggestion {
  topic: string
  why: string
}

export function parseTopics(json: unknown): TopicSuggestion[] {
  const list = (json as { topics?: unknown })?.topics
  if (!Array.isArray(list)) throw new Error('AI tidak memberi daftar topik.')
  const seen = new Set<string>()
  const out: TopicSuggestion[] = []
  for (const item of list) {
    const r = (typeof item === 'string' ? { topic: item } : typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    // Buang penomoran daftar ("1. ", "- ") dan tanda kutip, tapi biarkan angka yang bagian dari topik ("7 keajaiban").
    const topic = clean(r.topic).replace(/^(?:\d+[.)]\s+|[-•*]\s+)/, '').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, 120)
    if (topic.length < 3 || seen.has(topic.toLowerCase())) continue
    seen.add(topic.toLowerCase())
    out.push({ topic, why: clean(r.why).slice(0, 140) })
  }
  if (out.length === 0) throw new Error('AI tidak memberi topik yang bisa dipakai. Coba lagi.')
  return out.slice(0, SUGGESTION_COUNT)
}

const clean = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/** Validasi ketat keluaran AI. Melempar pesan jelas bila bentuknya tidak bisa dipakai. */
/** Batas pengaman jumlah kalimat dari AI (cukup untuk durasi sangat panjang). */
const MAX_SENTENCES = 720

/** Hook terpanjang yang masih diterima (lebih longgar dari permintaan di prompt): kata untuk bahasa berspasi, karakter untuk lainnya. */
const HOOK_MAX = { word: 20, char: 50 }

const contentWords = (text: string, language: string): Set<string> =>
  new Set((text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w) => !(STOPWORDS[language]?.has(w) ?? false)))

/** Periksa hook dari AI. Mengembalikan hook yang bisa dipakai, atau alasan penolakannya. */
function checkHook(j: Record<string, unknown>, body: ScriptSentence[], language: string, title: string): { hook: string | null; keywords: string[]; issue: string | null } {
  const hook = clean(j.hook)
  if (!hook) return { hook: null, keywords: [], issue: 'AI tidak menulis hook.' }
  const spaced = languageInfo(language).unit !== 'char'
  const size = spaced ? hook.split(/\s+/).length : [...hook].length
  if (size > (spaced ? HOOK_MAX.word : HOOK_MAX.char)) return { hook: null, keywords: [], issue: 'Hook dari AI terlalu panjang.' }
  if (hook.toLowerCase() === body[0]?.text.toLowerCase()) return { hook: null, keywords: [], issue: 'Hook sama dengan kalimat pertama isi.' }
  const keywords = (Array.isArray(j.hookKeywords) ? j.hookKeywords : []).map(clean).filter(Boolean).slice(0, 4)
  const result = { hook, keywords: keywords.length ? keywords : body[0]?.keywords ?? [title] }
  // Hook harus berasal dari isi: sedikitnya satu kata bermakna sama-sama muncul. Bahasa tanpa spasi tidak diperiksa.
  if (spaced) {
    const mine = contentWords(hook, language)
    const theirs = contentWords(body.map((s) => s.text).join(' ') + ' ' + title, language)
    if (mine.size >= 2 && ![...mine].some((w) => theirs.has(w))) return { ...result, hook, issue: 'Hook tampak tidak berkaitan dengan isi naskah.' }
  }
  return { ...result, issue: null }
}

export function parseScript(json: unknown, opts: { hook?: boolean; language?: string } = {}): FaktaScript {
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
  if (sentences.length > MAX_SENTENCES) sentences.length = MAX_SENTENCES

  const tags = (Array.isArray(j.tags) ? j.tags : []).map(clean).filter(Boolean).slice(0, 12)
  const checked = opts.hook ? checkHook(j, sentences, opts.language ?? 'id', title) : { hook: null, keywords: [], issue: null }
  // Hook yang tidak nyambung dengan isi tetap dikembalikan, bersama alasannya, supaya pemanggil bisa meminta ulang dulu.
  return { title, hook: checked.hook, hookKeywords: checked.keywords, hookIssue: checked.issue, sentences, description: clean(j.description), tags }
}

const STOPWORDS: Record<string, Set<string>> = {
  id: new Set('yang dan di ke dari untuk dengan adalah ini itu pada tidak bisa karena atau sebuah kamu akan juga lebih sangat para saat sudah masih'.split(' ')),
  en: new Set('the and of to in is that are for with it as on by this be was can their from have not but his which more'.split(' '))
}

/**
 * Bahasa Indonesia dan Inggris sering tertukar karena kata kunci footage diminta berbahasa Inggris. Hitung kata fungsi
 * kedua bahasa; naskah dianggap salah bahasa bila bahasa lain jelas lebih banyak. Bahasa lain tidak diperiksa.
 */
export function scriptLanguageMismatch(script: FaktaScript, language: string): boolean {
  const want = STOPWORDS[language]
  if (!want) return false
  const other = STOPWORDS[language === 'id' ? 'en' : 'id']
  let a = 0
  let b = 0
  for (const s of script.sentences) {
    for (const w of s.text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? []) {
      if (want.has(w)) a++
      else if (other.has(w)) b++
    }
  }
  return b >= 3 && b > a * 1.5
}

/** Naskah dianggap pas bila panjangnya dalam ±40% target. Hanya peringatan, bukan penolakan. */
export function scriptLengthWarning(script: FaktaScript, o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): string | null {
  const got = script.sentences.reduce((n, s) => n + speechUnits(s.text, o.language), script.hook ? speechUnits(script.hook, o.language) : 0)
  const { amount, unit } = targetLength(o)
  if (got < amount * 0.6) return `Naskah agak pendek (${got} ${unit}, target sekitar ${amount}).`
  if (got > amount * 1.4) return `Naskah agak panjang (${got} ${unit}, target sekitar ${amount}).`
  return null
}

/** Kategori YouTube bawaan mode ini (Education). */
export const DEFAULT_CATEGORY_ID = '27'
