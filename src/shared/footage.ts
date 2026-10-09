/**
 * Pustaka footage lokal: klip stock yang pernah diunduh dicatat dengan kata kunci yang menemukannya, lalu dipakai
 * ulang bila cocok. Murni (tanpa Electron atau Node API), supaya aturan pemilihannya bisa diuji.
 */

/** Klip dihindari bila dipakai dalam sekian video terakhir. */
export const RECENT_WINDOW = 10
/** Pustaka dipakai bila ada sedikitnya ini kandidat cocok (agar pilihan tetap bervariasi); kurang dari itu, tanya API. */
export const MIN_LOCAL_CANDIDATES = 3
/** Peluang meminta API walau pustaka punya kandidat, supaya stok terus segar. */
export const REFRESH_RATE = 0.25
/** Kemiripan kata kunci minimum (0 sampai 1) agar klip dianggap cocok. */
export const MIN_MATCH = 0.5
/** Pilih acak di antara sekian kandidat terbaik. */
export const TOP_PICK = 3
/** Jumlah frasa pencarian yang diingat per klip. */
export const MAX_PHRASES = 12

/** Ringkasan pustaka untuk Settings. */
export interface FootageInfo {
  count: number
  bytes: number
  /** Folder utama; klip ada di subfolder per penyedia. */
  root: string
}

export interface LocalClip {
  provider: string
  id: number
  path: string
  duration: number
  width: number
  height: number
  /** Frasa pencarian (huruf kecil) yang pernah menemukan klip ini. */
  phrases: string[]
  uses: number
  /** Nomor video terakhir yang memakai klip ini; 0 = belum pernah. */
  lastSeq: number
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'over', 'under', 'near', 'that', 'this', 'are', 'was', 'its'])

export function normalizePhrase(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** Kata penting dari satu frasa pencarian. */
export function termsOf(phrase: string): Set<string> {
  return new Set(normalizePhrase(phrase).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)))
}

/** Kemiripan dua frasa: irisan kata dibagi gabungannya. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let both = 0
  for (const t of a) if (b.has(t)) both++
  return both / (a.size + b.size - both)
}

/** Kecocokan terbaik antara frasa klip dan frasa pencarian kalimat. */
export function matchScore(clipPhrases: string[], queries: string[]): number {
  const q = queries.map(termsOf)
  let best = 0
  for (const p of clipPhrases) {
    const pt = termsOf(p)
    for (const t of q) best = Math.max(best, jaccard(pt, t))
  }
  return best
}

export interface RankOptions {
  neededSec: number
  /** Klip yang sudah dipakai di video ini. */
  used: Set<number>
  /** Nomor video saat ini. */
  seq: number
  /** Abaikan jendela "baru dipakai" dan batas kecocokan (untuk cadangan saat API gagal). */
  relaxed?: boolean
}

/** Kandidat dari pustaka, terbaik dulu. Klip yang baru dipakai, atau sudah dipakai di video ini, tidak ikut. */
export function rankLocal(clips: LocalClip[], queries: string[], o: RankOptions): LocalClip[] {
  const scored: { clip: LocalClip; score: number }[] = []
  for (const clip of clips) {
    if (o.used.has(clip.id)) continue
    const recent = clip.lastSeq > 0 && o.seq - clip.lastSeq < RECENT_WINDOW
    if (recent && !o.relaxed) continue
    const match = matchScore(clip.phrases, queries)
    if (match < (o.relaxed ? 0.2 : MIN_MATCH)) continue
    const vertical = clip.height >= clip.width ? 20 : 0
    const long = clip.duration >= o.neededSec ? 20 : Math.min(clip.duration, o.neededSec)
    // Yang jarang dipakai didahulukan agar footage tidak monoton.
    const score = match * 100 + vertical + long - clip.uses * 4 - (recent ? 50 : 0)
    scored.push({ clip, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.clip)
}

/** Ambil satu dari beberapa kandidat terbaik secara acak (`rng` mengembalikan 0 sampai <1). */
export function pickAmongTop<T>(ranked: T[], rng: () => number): T | null {
  if (ranked.length === 0) return null
  return ranked[Math.min(ranked.length, TOP_PICK) * rng() | 0]
}

/** Gabung frasa baru ke daftar frasa klip: unik, yang terbaru di depan, dibatasi. */
export function mergePhrases(existing: string[], add: string[]): string[] {
  const out: string[] = []
  for (const p of [...add.map(normalizePhrase), ...existing]) if (p && !out.includes(p)) out.push(p)
  return out.slice(0, MAX_PHRASES)
}
