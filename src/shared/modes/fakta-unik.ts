/**
 * Mode Fakta Unik: preset, opsi, dan bentuk naskah. Murni (tanpa Electron/Node), dipakai form di renderer
 * dan pipeline di main. Mode lain tidak boleh mengimpor file ini.
 */

import { CAPTION_TEMPLATES, DEFAULT_CAPTION, sanitizeCaption, type CaptionStyle } from '../captions.ts'
import { LANGUAGE_CODES, VOICE_SOURCES, languageInfo, speechUnits, type LanguageCode, type VoiceSource } from '../languages.ts'
import { STOCK_SOURCES } from '../stock.ts'

export const TARGET_SECONDS = [30, 45, 60] as const

export interface FaktaUnikOptions {
  /** Topik atau niche, mis. "fakta aneh tentang laut dalam". */
  topic: string
  language: LanguageCode
  targetSec: (typeof TARGET_SECONDS)[number]
  voiceSource: VoiceSource
  /** ID suara (Gemini: mis. "Kore"; Deepgram: "aura-2-thalia-en"; Piper: nama model). Kosong = bawaan. */
  voiceName: string
  caption: CaptionStyle
  /** Penyedia footage stock. */
  stockSource: (typeof STOCK_SOURCES)[number]
  /** Topik yang sudah pernah dipakai, supaya tidak berulang. */
  avoid: string[]
}

export const DEFAULT_OPTIONS: FaktaUnikOptions = {
  topic: '',
  language: 'id',
  targetSec: 45,
  voiceSource: 'piper',
  voiceName: '',
  caption: DEFAULT_CAPTION,
  stockSource: 'pixabay',
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

  return {
    topic,
    language: pick(LANGUAGE_CODES, o.language, DEFAULT_OPTIONS.language),
    targetSec: pick(TARGET_SECONDS, o.targetSec, DEFAULT_OPTIONS.targetSec),
    voiceSource: pick(VOICE_SOURCES, o.voiceSource, DEFAULT_OPTIONS.voiceSource),
    voiceName: typeof o.voiceName === 'string' ? o.voiceName.trim().slice(0, 80) : '',
    caption: captionFrom(o),
    stockSource: pick(STOCK_SOURCES, o.stockSource, DEFAULT_OPTIONS.stockSource),
    avoid: Array.isArray(o.avoid) ? o.avoid.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 50) : []
  }
}

/** Perkiraan panjang naskah yang pas untuk durasi target, dalam satuan bahasanya (kata atau karakter). */
export function targetLength(o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): { amount: number; unit: 'kata' | 'karakter' } {
  const lang = languageInfo(o.language)
  return { amount: Math.round(lang.rate * o.targetSec), unit: lang.unit === 'char' ? 'karakter' : 'kata' }
}

export function buildScriptPrompt(o: FaktaUnikOptions): { system: string; user: string } {
  const lang = languageInfo(o.language)
  const len = targetLength(o)
  const perSentence = lang.unit === 'char' ? '12 sampai 45 karakter' : '6 sampai 22 kata'
  const system = [
    'Kamu penulis naskah video pendek vertikal "fakta unik" untuk YouTube Shorts.',
    'Tulis naskah yang akurat, menarik, dan orisinal. Jangan mengarang angka atau klaim yang tidak pasti; bila ragu, pilih fakta lain.',
    'Kalimat pertama adalah hook yang membuat penonton bertahan. Kalimat terakhir menutup dengan kesan kuat, tanpa meminta like atau subscribe.',
    `Tulis judul, kalimat naskah, deskripsi, dan tag dalam ${lang.promptName}, dengan gaya bertutur yang alami bagi penutur aslinya.`,
    'Keluaran HANYA JSON valid sesuai skema, tanpa teks lain.'
  ].join(' ')

  const avoid = o.avoid.length ? `\nJangan membahas hal yang sudah pernah dipakai: ${o.avoid.map((a) => `"${a}"`).join(', ')}.` : ''
  const user = [
    `Topik: ${o.topic}`,
    `Bahasa naskah: ${lang.promptName}.`,
    `Total sekitar ${len.amount} ${len.unit} (target ${o.targetSec} detik), dibagi 6 sampai 10 kalimat. Tiap kalimat ${perSentence}, mudah diucapkan.`,
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

/** Naskah dianggap pas bila panjangnya dalam ±40% target. Hanya peringatan, bukan penolakan. */
export function scriptLengthWarning(script: FaktaScript, o: Pick<FaktaUnikOptions, 'language' | 'targetSec'>): string | null {
  const got = script.sentences.reduce((n, s) => n + speechUnits(s.text, o.language), 0)
  const { amount, unit } = targetLength(o)
  if (got < amount * 0.6) return `Naskah agak pendek (${got} ${unit}, target sekitar ${amount}).`
  if (got > amount * 1.4) return `Naskah agak panjang (${got} ${unit}, target sekitar ${amount}).`
  return null
}

/** Kategori YouTube bawaan mode ini (Education). */
export const DEFAULT_CATEGORY_ID = '27'
