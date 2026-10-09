/**
 * Bahasa konten yang bisa dipilih mode, dan sumber suara mana yang mendukungnya. Murni, dipakai renderer dan main.
 * Naskah ditulis AI (Gemini/Groq) dan caption dirender libass dengan cadangan font Windows, jadi semua bahasa
 * di sini aman sampai video jadi. Yang membatasi hanya sumber suaranya.
 */

export interface LanguageInfo {
  code: string
  /** Nama di UI. */
  label: string
  /** Nama bahasa untuk prompt AI. */
  promptName: string
  /** Bahasa tanpa spasi antar kata (Jepang, Mandarin, Thai) diukur per karakter. */
  unit: 'word' | 'char'
  /** Kecepatan ucap narasi rata-rata: kata atau karakter per detik. */
  rate: number
  /** Kode bahasa untuk metadata YouTube. */
  youtube: string
}

export const LANGUAGE_LIST = [
  { code: 'id', label: 'Indonesia', promptName: 'Bahasa Indonesia', unit: 'word', rate: 2.6, youtube: 'id' },
  { code: 'en', label: 'Inggris', promptName: 'English', unit: 'word', rate: 2.5, youtube: 'en' },
  { code: 'ms', label: 'Melayu', promptName: 'Bahasa Melayu (Malaysia)', unit: 'word', rate: 2.6, youtube: 'ms' },
  { code: 'jv', label: 'Jawa', promptName: 'Basa Jawa (ngoko, santai)', unit: 'word', rate: 2.6, youtube: 'jv' },
  { code: 'su', label: 'Sunda', promptName: 'Basa Sunda (loma, santai)', unit: 'word', rate: 2.6, youtube: 'su' },
  { code: 'es', label: 'Spanyol', promptName: 'Español', unit: 'word', rate: 2.8, youtube: 'es' },
  { code: 'pt', label: 'Portugis (Brasil)', promptName: 'Português do Brasil', unit: 'word', rate: 2.7, youtube: 'pt' },
  { code: 'fr', label: 'Prancis', promptName: 'Français', unit: 'word', rate: 2.7, youtube: 'fr' },
  { code: 'de', label: 'Jerman', promptName: 'Deutsch', unit: 'word', rate: 2.3, youtube: 'de' },
  { code: 'it', label: 'Italia', promptName: 'Italiano', unit: 'word', rate: 2.7, youtube: 'it' },
  { code: 'nl', label: 'Belanda', promptName: 'Nederlands', unit: 'word', rate: 2.5, youtube: 'nl' },
  { code: 'ru', label: 'Rusia', promptName: 'Русский', unit: 'word', rate: 2.2, youtube: 'ru' },
  { code: 'tr', label: 'Turki', promptName: 'Türkçe', unit: 'word', rate: 2.2, youtube: 'tr' },
  { code: 'vi', label: 'Vietnam', promptName: 'Tiếng Việt', unit: 'word', rate: 3.2, youtube: 'vi' },
  { code: 'fil', label: 'Filipina', promptName: 'Filipino (Tagalog)', unit: 'word', rate: 2.5, youtube: 'fil' },
  { code: 'hi', label: 'Hindi', promptName: 'हिन्दी (Hindi)', unit: 'word', rate: 2.6, youtube: 'hi' },
  { code: 'ar', label: 'Arab', promptName: 'العربية (Modern Standard Arabic)', unit: 'word', rate: 2.1, youtube: 'ar' },
  { code: 'ko', label: 'Korea', promptName: '한국어 (Korean)', unit: 'word', rate: 2.4, youtube: 'ko' },
  { code: 'ja', label: 'Jepang', promptName: '日本語 (Japanese)', unit: 'char', rate: 7, youtube: 'ja' },
  { code: 'zh', label: 'Mandarin', promptName: '简体中文 (Simplified Chinese)', unit: 'char', rate: 4.5, youtube: 'zh-CN' },
  { code: 'th', label: 'Thai', promptName: 'ภาษาไทย (Thai)', unit: 'char', rate: 9, youtube: 'th' }
] as const satisfies readonly LanguageInfo[]

export type LanguageCode = (typeof LANGUAGE_LIST)[number]['code']
export const LANGUAGE_CODES = LANGUAGE_LIST.map((l) => l.code) as LanguageCode[]

export function languageInfo(code: string): LanguageInfo {
  return LANGUAGE_LIST.find((l) => l.code === code) ?? LANGUAGE_LIST[0]
}

/** Panjang teks dalam satuan ucap bahasanya (kata, atau karakter non-spasi/tanda baca). */
export function speechUnits(text: string, code: string): number {
  if (languageInfo(code).unit === 'char') return [...text.replace(/[\s\p{P}]/gu, '')].length
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Pecah teks jadi kata. Bahasa tanpa spasi memakai pemenggal kata bawaan (Intl.Segmenter). */
export function splitWords(text: string, code: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return []
  if (languageInfo(code).unit === 'word') return t.split(' ')
  const seg = new Intl.Segmenter(code, { granularity: 'word' })
  const out: string[] = []
  for (const s of seg.segment(t)) {
    if (!s.segment.trim()) continue
    // Tanda baca menempel ke kata sebelumnya supaya tidak tampil sendirian.
    if (!s.isWordLike && out.length) out[out.length - 1] += s.segment
    else out.push(s.segment)
  }
  return out
}

/* ---- Suara ---- */

export const VOICE_SOURCES = ['piper', 'gemini-tts', 'deepgram'] as const
export type VoiceSource = (typeof VOICE_SOURCES)[number]

export interface VoiceOption {
  id: string
  label: string
}

/** Suara bawaan Gemini TTS. Bahasa dideteksi otomatis dari teks, jadi semua suara bisa dipakai untuk semua bahasa. */
export const GEMINI_VOICES: VoiceOption[] = [
  ['Kore', 'tegas'], ['Puck', 'ceria'], ['Charon', 'informatif'], ['Zephyr', 'cerah'], ['Fenrir', 'bersemangat'],
  ['Leda', 'muda'], ['Orus', 'tegas'], ['Aoede', 'ringan'], ['Callirrhoe', 'santai'], ['Autonoe', 'cerah'],
  ['Enceladus', 'berbisik'], ['Iapetus', 'jernih'], ['Umbriel', 'santai'], ['Algieba', 'halus'], ['Despina', 'halus'],
  ['Erinome', 'jernih'], ['Algenib', 'serak'], ['Rasalgethi', 'informatif'], ['Laomedeia', 'ceria'], ['Achernar', 'lembut'],
  ['Alnilam', 'mantap'], ['Schedar', 'datar'], ['Gacrux', 'dewasa'], ['Pulcherrima', 'lugas'], ['Achird', 'ramah'],
  ['Zubenelgenubi', 'kasual'], ['Vindemiatrix', 'lembut'], ['Sadachbia', 'hidup'], ['Sadaltager', 'berpengetahuan'], ['Sulafat', 'hangat']
].map(([id, tone]) => ({ id, label: `${id} · ${tone}` }))

const dg = (lang: string, names: string): VoiceOption[] =>
  names.split(' ').map((n) => {
    const [name, accent] = n.split(':')
    return { id: `aura-2-${name}-${lang}`, label: `${name[0].toUpperCase()}${name.slice(1)}${accent ? ` · ${accent}` : ''}` }
  })

/** Suara Deepgram Aura-2 per bahasa (developers.deepgram.com/docs/tts-models). */
export const DEEPGRAM_VOICES: Partial<Record<LanguageCode, VoiceOption[]>> = {
  en: dg('en', 'thalia asteria luna athena helena hera aurora callista cora delia iris juno minerva ophelia phoebe selene vesta andromeda harmonia electra cordelia amalthea:Filipina theia:Australia pandora:Inggris apollo arcas aries atlas hermes janus jupiter mars neptune odysseus orion orpheus pluto saturn zeus draco:Inggris hyperion:Australia'),
  es: dg('es', 'carina diana agustina silvia nestor alvaro estrella olivia sirio javier luciano valerio celeste gloria aquila selena antonia'),
  de: dg('de', 'elara aurelia lara kara viktoria julius fabian'),
  fr: dg('fr', 'agathe hector'),
  nl: dg('nl', 'beatrix daphne cornelia hestia rhea leda sander lars roman'),
  it: dg('it', 'melia maia cinzia livia demetra elio flavio cesare dionisio'),
  ja: dg('ja', 'uzume izanami ama ebisu fujin')
}

/** Apakah sumber suara bisa membacakan bahasa ini. Piper bergantung pada model yang terpasang. */
export function voiceSourceSupports(source: VoiceSource, code: string, piperLangs: string[] = []): boolean {
  if (source === 'gemini-tts') return true
  if (source === 'deepgram') return Boolean(DEEPGRAM_VOICES[code as LanguageCode]?.length)
  return piperLangs.includes(code)
}

/** Pemisah antar kata saat potongan caption disusun kembali jadi teks. */
export const wordJoiner = (code: string): string => (languageInfo(code).unit === 'char' ? '' : ' ')
