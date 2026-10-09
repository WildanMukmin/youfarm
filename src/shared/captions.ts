/**
 * Gaya caption yang bisa diatur pengguna, dipakai bersama oleh pratinjau di renderer dan pembuat ASS di main,
 * supaya pratinjau sama dengan hasil video. Murni, bisa dipakai mode apa pun yang membakar caption.
 * Ukuran dan posisi diukur pada frame acuan 1080x1920.
 */

export const CAPTION_REF_WIDTH = 1080
export const CAPTION_REF_HEIGHT = 1920

export interface CaptionFont {
  family: string
  /** Dibundel bersama aplikasi (assets/fonts/caption), atau font bawaan Windows. */
  bundled: boolean
}

export const CAPTION_FONTS: CaptionFont[] = [
  ...['Poppins', 'Poppins Black', 'Anton', 'Bebas Neue', 'Archivo Black', 'Bangers', 'Luckiest Guy'].map((family) => ({ family, bundled: true })),
  ...['Arial Black', 'Impact', 'Segoe UI Black', 'Bahnschrift', 'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Comic Sans MS'].map((family) => ({
    family,
    bundled: false
  }))
]

export const CAPTION_ANIMATIONS = ['none', 'pop', 'fade', 'word-zoom'] as const
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number]

export const CAPTION_ANIMATION_LABEL: Record<CaptionAnimation, string> = {
  none: 'Tanpa animasi',
  pop: 'Muncul membesar',
  fade: 'Memudar masuk',
  'word-zoom': 'Zoom kata aktif'
}

export interface CaptionStyle {
  font: string
  /** Tinggi huruf dalam px pada frame 1920. */
  size: number
  bold: boolean
  uppercase: boolean
  /** Warna #RRGGBB. */
  color: string
  /** Kata yang sedang diucapkan diberi warna sorot. */
  highlight: boolean
  highlightColor: string
  outlineColor: string
  /** Tebal garis tepi dalam px (0 = tanpa). */
  outline: number
  /** Jarak bayangan dalam px (0 = tanpa). */
  shadow: number
  /** Kotak latar di belakang teks, menggantikan garis tepi. */
  box: boolean
  boxColor: string
  /** 0 sampai 100. */
  boxOpacity: number
  /** Kata per tampilan. */
  wordsPerChunk: number
  animation: CaptionAnimation
  /** Titik tengah teks dari atas, persen tinggi frame. */
  positionY: number
  /** Perataan teks dalam kolom selebar frame (dikurangi margin tepi). */
  align: CaptionAlign
}

export const CAPTION_ALIGNS = ['left', 'center', 'right'] as const
export type CaptionAlign = (typeof CAPTION_ALIGNS)[number]
/** Margin kiri dan kanan kolom caption, persen lebar frame. */
export const CAPTION_SIDE_MARGIN = 7

export const LIMITS = {
  size: [40, 220],
  outline: [0, 16],
  shadow: [0, 10],
  boxOpacity: [0, 100],
  wordsPerChunk: [1, 5],
  positionY: [10, 90]
} as const satisfies Record<string, readonly [number, number]>

export const DEFAULT_CAPTION: CaptionStyle = {
  font: 'Poppins',
  size: 92,
  bold: true,
  uppercase: true,
  color: '#FFFFFF',
  highlight: true,
  highlightColor: '#FFD400',
  outlineColor: '#000000',
  outline: 7,
  shadow: 2,
  box: false,
  boxColor: '#000000',
  boxOpacity: 60,
  wordsPerChunk: 3,
  animation: 'pop',
  positionY: 68,
  align: 'center'
}

export interface CaptionTemplate {
  id: string
  label: string
  style: CaptionStyle
}

const tpl = (id: string, label: string, over: Partial<CaptionStyle>): CaptionTemplate => ({ id, label, style: { ...DEFAULT_CAPTION, ...over } })

/** Titik awal cepat. Memilih template mengisi semua kolom; setelah itu tiap kolom tetap bisa diubah. */
export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  tpl('sorot-kuning', 'Sorot kuning', {}),
  tpl('kuning-tebal', 'Kuning tebal', { color: '#FFF000', highlight: false, animation: 'none', positionY: 72 }),
  tpl('putih-bersih', 'Putih bersih', { uppercase: false, highlight: false, outline: 5, animation: 'none', positionY: 72 }),
  tpl('kotak-gelap', 'Kotak gelap', { uppercase: false, highlight: false, outline: 0, box: true, boxColor: '#101010', boxOpacity: 70, animation: 'fade', positionY: 72 }),
  tpl('hormozi', 'Tebal hijau', { font: 'Anton', size: 104, bold: false, highlightColor: '#39FF6A', outline: 9, shadow: 0, wordsPerChunk: 2, animation: 'word-zoom', positionY: 62 }),
  tpl('komik', 'Komik', { font: 'Bangers', size: 110, bold: false, highlightColor: '#FF3DAA', outline: 8, wordsPerChunk: 2, animation: 'pop' }),
  tpl('bioskop', 'Bioskop', { font: 'Bebas Neue', size: 112, bold: false, highlight: false, outline: 0, shadow: 6, wordsPerChunk: 4, animation: 'fade', positionY: 80 }),
  tpl('satu-kata', 'Satu kata', { font: 'Luckiest Guy', size: 130, bold: false, highlight: false, color: '#FFFFFF', outline: 10, wordsPerChunk: 1, animation: 'pop', positionY: 55 })
]

const HEX = /^#[0-9a-f]{6}$/i

function clamp(v: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

const color = (v: unknown, fallback: string): string => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback)
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

/** Rapikan gaya dari luar (IPC, antrean lama). Nilai tak valid kembali ke bawaan, angka dijepit ke rentangnya. */
export function sanitizeCaption(input: unknown): CaptionStyle {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const d = DEFAULT_CAPTION
  const font = typeof o.font === 'string' && CAPTION_FONTS.some((f) => f.family === o.font) ? o.font : d.font
  return {
    font,
    size: clamp(o.size, LIMITS.size, d.size),
    bold: bool(o.bold, d.bold),
    uppercase: bool(o.uppercase, d.uppercase),
    color: color(o.color, d.color),
    highlight: bool(o.highlight, d.highlight),
    highlightColor: color(o.highlightColor, d.highlightColor),
    outlineColor: color(o.outlineColor, d.outlineColor),
    outline: clamp(o.outline, LIMITS.outline, d.outline),
    shadow: clamp(o.shadow, LIMITS.shadow, d.shadow),
    box: bool(o.box, d.box),
    boxColor: color(o.boxColor, d.boxColor),
    boxOpacity: clamp(o.boxOpacity, LIMITS.boxOpacity, d.boxOpacity),
    wordsPerChunk: clamp(o.wordsPerChunk, LIMITS.wordsPerChunk, d.wordsPerChunk),
    animation: CAPTION_ANIMATIONS.includes(o.animation as CaptionAnimation) ? (o.animation as CaptionAnimation) : d.animation,
    positionY: clamp(o.positionY, LIMITS.positionY, d.positionY),
    align: CAPTION_ALIGNS.includes(o.align as CaptionAlign) ? (o.align as CaptionAlign) : d.align
  }
}

export function templateOf(style: CaptionStyle): CaptionTemplate | undefined {
  return CAPTION_TEMPLATES.find((t) => (Object.keys(style) as (keyof CaptionStyle)[]).every((k) => t.style[k] === style[k]))
}

/* ---- Potongan dan waktu ---- */

export interface TimedWord {
  text: string
  start: number
  end: number
}

export interface CaptionChunk {
  words: TimedWord[]
  start: number
  end: number
}

/** Kata berakhir dengan tanda baca penutup klausa: potongan caption berhenti di sini. */
const CLAUSE_END = /[.,!?;:。、！？，；：…]$/u

/**
 * Kelompokkan kata jadi potongan berisi paling banyak `perChunk` kata, dipotong juga di akhir klausa.
 * Dengan `maxChars` (bahasa tanpa spasi, yang katanya sering hanya 1 sampai 2 huruf) batasnya jumlah karakter.
 */
export function chunkWords(words: TimedWord[], perChunk: number, maxChars?: number): CaptionChunk[] {
  const size = Math.max(1, Math.round(perChunk) || 1)
  const chunks: CaptionChunk[] = []
  let cur: TimedWord[] = []
  let chars = 0
  const flush = (): void => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end })
    cur = []
    chars = 0
  }
  for (const w of words) {
    const len = [...w.text].length
    if (maxChars && cur.length && chars + len > maxChars) flush()
    cur.push(w)
    chars += len
    if ((!maxChars && cur.length >= size) || CLAUSE_END.test(w.text)) flush()
  }
  flush()
  return chunks
}

/**
 * Perkirakan waktu tiap kata dalam rentang ucapan kalimat: sebanding jumlah karakternya, ditambah bobot
 * tetap per kata (jeda antar kata). Cukup akurat untuk suara sintetis yang temponya rata.
 */
export function timeWords(words: string[], start: number, speechSec: number): TimedWord[] {
  const weight = (w: string): number => [...w].length + 2
  const total = words.reduce((n, w) => n + weight(w), 0) || 1
  let t = start
  return words.map((text) => {
    const d = (weight(text) / total) * speechSec
    const w = { text, start: t, end: t + d }
    t += d
    return w
  })
}
