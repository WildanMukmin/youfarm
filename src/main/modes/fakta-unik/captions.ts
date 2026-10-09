import type { FaktaUnikOptions } from '../../../shared/modes/fakta-unik.ts'

export interface Cue {
  start: number
  end: number
  text: string
}

export interface SentenceTiming {
  text: string
  /** Awal kalimat di narasi gabungan (detik). */
  start: number
  /** Lama ucapan kalimat itu sendiri (tanpa jeda penutup). */
  speechSec: number
}

/**
 * Pecah kalimat jadi potongan pendek (default maks 3 kata dan 22 karakter) supaya caption
 * terbaca cepat di layar vertikal.
 */
export function splitCaptionChunks(text: string, maxWords = 3, maxChars = 22): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let cur: string[] = []
  for (const w of words) {
    const next = [...cur, w]
    if (cur.length > 0 && (next.length > maxWords || next.join(' ').length > maxChars)) {
      chunks.push(cur.join(' '))
      cur = [w]
    } else cur = next
    // Akhir klausa: potong di tanda baca supaya jeda caption mengikuti jeda ucapan.
    if (/[.,!?;:]$/.test(w)) {
      chunks.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length) chunks.push(cur.join(' '))
  return chunks
}

/** Waktu tiap potongan dibagi sebanding jumlah karakternya dalam rentang ucapan kalimat. */
export function buildCues(sentences: SentenceTiming[]): Cue[] {
  const cues: Cue[] = []
  for (const s of sentences) {
    const chunks = splitCaptionChunks(s.text)
    const total = chunks.reduce((n, c) => n + c.length, 0) || 1
    let t = s.start
    for (const c of chunks) {
      const d = (c.length / total) * s.speechSec
      cues.push({ start: t, end: t + d, text: c })
      t += d
    }
  }
  return cues
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0')

function assTime(sec: number): string {
  const cs = Math.round(sec * 100)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`
}

function srtTime(sec: number): string {
  const ms = Math.round(sec * 1000)
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))},${pad(ms % 1000, 3)}`
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n')
}

interface StyleSpec {
  /** Warna ASS dalam format &HAABBGGRR. */
  primary: string
  outline: string
  back: string
  borderStyle: 1 | 3
  outlineSize: number
  upper: boolean
}

const STYLES: Record<FaktaUnikOptions['captionStyle'], StyleSpec> = {
  'kuning-tebal': { primary: '&H0000F0FF', outline: '&H00000000', back: '&H80000000', borderStyle: 1, outlineSize: 7, upper: true },
  'putih-bersih': { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H80000000', borderStyle: 1, outlineSize: 5, upper: false },
  'kotak-gelap': { primary: '&H00FFFFFF', outline: '&H00101010', back: '&HB0101010', borderStyle: 3, outlineSize: 14, upper: false }
}

const escapeAss = (s: string): string => s.replace(/\\/g, '＼').replace(/[{}]/g, '').replace(/\r?\n/g, ' ')

/** Berkas ASS 1080x1920. `fontName` harus ada di folder font yang diberikan ke ffmpeg. */
export function toAss(cues: Cue[], style: FaktaUnikOptions['captionStyle'], fontName = 'Poppins'): string {
  const s = STYLES[style]
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},84,${s.primary},${s.primary},${s.outline},${s.back},-1,0,0,0,100,100,0,0,${s.borderStyle},${s.outlineSize},2,2,60,60,520,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ]
  const lines = cues.map((c) => {
    const text = escapeAss(s.upper ? c.text.toUpperCase() : c.text)
    return `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${text}`
  })
  return [...header, ...lines, ''].join('\n')
}
