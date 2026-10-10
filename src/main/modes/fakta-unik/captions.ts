import { CAPTION_REF_HEIGHT, CAPTION_REF_WIDTH, CAPTION_SIDE_MARGIN, chunkWords, timeWords, type CaptionChunk, type CaptionStyle } from '../../../shared/captions.ts'
import { languageInfo, splitWords, wordJoiner } from '../../../shared/languages.ts'

export interface SentenceTiming {
  text: string
  /** Awal kalimat di narasi gabungan (detik). */
  start: number
  /** Lama ucapan kalimat itu sendiri (tanpa jeda penutup). */
  speechSec: number
}

/** Potongan caption per kalimat (potongan tidak pernah melewati batas kalimat), dengan perkiraan waktu tiap kata. */
export function buildChunks(sentences: SentenceTiming[], language: string, wordsPerChunk: number): CaptionChunk[] {
  // Bahasa tanpa spasi: sekitar 4 karakter dianggap satu "kata" untuk pilihan kata per tampilan.
  const maxChars = languageInfo(language).unit === 'char' ? wordsPerChunk * 4 : undefined
  return sentences.flatMap((s) => chunkWords(timeWords(splitWords(s.text, language), s.start, s.speechSec), wordsPerChunk, maxChars))
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0')

function assTime(sec: number): string {
  const cs = Math.round(Math.max(0, sec) * 100)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`
}

function srtTime(sec: number): string {
  const ms = Math.round(sec * 1000)
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))},${pad(ms % 1000, 3)}`
}

/** SRT untuk diunggah sebagai track caption YouTube (teks asli, tanpa huruf kapital paksa). */
export function toSrt(chunks: CaptionChunk[], language: string): string {
  const join = wordJoiner(language)
  return chunks.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.words.map((w) => w.text).join(join)}\n`).join('\n')
}

/** #RRGGBB jadi warna ASS &HAABBGGRR. `opacity` 0 sampai 100. */
export function assColor(hex: string, opacity = 100): string {
  const h = hex.replace('#', '')
  const alpha = Math.round(((100 - opacity) / 100) * 255)
  return `&H${alpha.toString(16).padStart(2, '0')}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase()
}

const escapeAss = (s: string): string => s.replace(/\\/g, '＼').replace(/[{}]/g, '').replace(/\r?\n/g, ' ')

/** Kata aktif: warna sorot dan/atau zoom singkat, lalu kembali normal untuk kata sesudahnya. */
function activeWord(text: string, style: CaptionStyle): string {
  const on: string[] = []
  const off: string[] = []
  if (style.highlight) {
    // Override warna memakai &HBBGGRR& (tanpa alpha).
    on.push(`\\1c&H${assColor(style.highlightColor).slice(4)}&`)
    off.push(`\\1c&H${assColor(style.color).slice(4)}&`)
  }
  if (style.animation === 'word-zoom') {
    on.push('\\t(0,90,\\fscx125\\fscy125)\\t(90,180,\\fscx100\\fscy100)')
    off.push('\\fscx100\\fscy100')
  }
  return on.length ? `{${on.join('')}}${text}{${off.join('')}}` : text
}

/** Efek saat potongan baru muncul. Hanya ditempel di event pertama tiap potongan. */
function chunkIntro(style: CaptionStyle): string {
  if (style.animation === 'pop') return '{\\fscx80\\fscy80\\t(0,110,\\fscx106\\fscy106)\\t(110,170,\\fscx100\\fscy100)}'
  if (style.animation === 'fade') return '{\\fad(160,0)}'
  return ''
}

/**
 * Berkas ASS dari potongan bertimestamp, berukuran `dims` (bawaan 1080x1920). Bila kata aktif disorot (warna atau
 * zoom), tiap kata jadi satu event supaya sorotnya hanya menyala saat kata itu diucapkan. Font harus ada di folder
 * font untuk ffmpeg atau terpasang di Windows; huruf yang tidak ada diambil libass dari font sistem.
 */
export function toAss(chunks: CaptionChunk[], style: CaptionStyle, language: string, dims: { width: number; height: number } = { width: CAPTION_REF_WIDTH, height: CAPTION_REF_HEIGHT }): string {
  const W = dims.width
  const H = dims.height
  // Ukuran dan garis di CaptionStyle dirancang untuk frame setinggi acuan (1920); format lain diskalakan sebanding tingginya.
  const scale = H / CAPTION_REF_HEIGHT
  const size = Math.round(style.size * scale)
  const outline = Math.round(style.outline * scale)
  const shadow = Math.round(style.shadow * scale)

  // Kolom selebar frame dikurangi margin tepi; tag pos menaruh titik jangkar di tepi kolom sesuai perataan,
  // dan MarginL/MarginR event membatasi lebar bungkus baris.
  const margin = Math.round((CAPTION_SIDE_MARGIN / 100) * W)
  const anchor = style.align === 'left' ? { an: 4, x: margin } : style.align === 'right' ? { an: 6, x: W - margin } : { an: 5, x: W / 2 }
  const pos = `{\\an${anchor.an}\\pos(${Math.round(anchor.x)},${Math.round((style.positionY / 100) * H)})}`

  const primary = assColor(style.color)
  // BorderStyle 3: kotak latar di belakang tiap baris; libass mewarnainya dengan OutlineColour dan
  // memakai nilai Outline sebagai jarak tepi kotak.
  const border = style.box
    ? { style: 3, color: assColor(style.boxColor, style.boxOpacity), size: Math.max(10, Math.round(size * 0.18)) }
    : { style: 1, color: assColor(style.outlineColor), size: outline }
  const shadowColor = assColor('#000000', 55)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,${style.font},${size},${primary},${primary},${border.color},${shadowColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,${border.style},${border.size},${shadow},5,${margin},${margin},0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ]

  const join = wordJoiner(language)
  const shape = (t: string): string => escapeAss(style.uppercase ? t.toLocaleUpperCase(language) : t)
  const perWord = style.highlight || style.animation === 'word-zoom'
  const line = (start: number, end: number, text: string): string => `Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,${margin},${margin},0,,${pos}${text}`

  const events: string[] = []
  chunks.forEach((c, ci) => {
    // Potongan tetap tampil sampai potongan berikutnya mulai bila jedanya pendek, supaya caption tidak berkedip.
    const next = chunks[ci + 1]
    const chunkEnd = next && next.start - c.end < 0.35 ? next.start : c.end
    const words = c.words.map((w) => shape(w.text))
    if (!perWord) {
      events.push(line(c.start, chunkEnd, chunkIntro(style) + words.join(join)))
      return
    }
    c.words.forEach((w, wi) => {
      const end = wi === c.words.length - 1 ? chunkEnd : c.words[wi + 1].start
      const text = words.map((t, k) => (k === wi ? activeWord(t, style) : t)).join(join)
      events.push(line(w.start, end, (wi === 0 ? chunkIntro(style) : '') + text))
    })
  })
  return [...header, ...events, ''].join('\n')
}
