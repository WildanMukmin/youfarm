/** Kontrak antara mode produksi dan sisa aplikasi (antrean, library, upload). Mode tidak saling mengenal. */

export const MODE_IDS = ['alur-cerita', 'fakta-unik', 'animasi-3d', 'kids', 'asmr-konstruksi', 'bedah-konten'] as const
export type ModeId = (typeof MODE_IDS)[number]

/** Mode yang menghasilkan video (Bedah Konten hanya menganalisis). */
export type ProductionModeId = Exclude<ModeId, 'bedah-konten'>

export const PRODUCTION_MODE_IDS = MODE_IDS.filter((m): m is ProductionModeId => m !== 'bedah-konten')

export type AspectRatio = '9:16' | '16:9' | '1:1'

/** Hasil satu mode produksi. Antrean, Library, dan Upload hanya mengenal bentuk ini. */
export interface RenderedVideo {
  /** Berkas video hasil render. */
  filePath: string
  thumbnailPath: string | null
  /** Berkas caption (.srt) untuk diunggah sebagai track, bila ada. */
  captionPath: string | null
  durationSec: number
  aspect: AspectRatio
  mode: ProductionModeId
  /** Nama template yang dipakai, untuk umpan balik ke analitik. */
  template: string | null
  title: string
  script: string
  /** True bila ada suara, gambar, atau video buatan AI yang realistis. */
  syntheticMedia: boolean
  language: string
  /** Baris kredit sumber (mis. footage stock) untuk deskripsi. Hasil lama belum punya. */
  credits?: string[]
}

/**
 * Aturan kepatuhan YouTube per mode:
 * - Kids otomatis "dibuat untuk anak". Mode lain tidak.
 * - Kids dan Animasi 3D selalu ditandai konten sintetis; mode lain mengikuti kenyataan produksinya.
 */
export function disclosureFor(mode: ProductionModeId, syntheticMedia: boolean): { madeForKids: boolean; containsSyntheticMedia: boolean } {
  return {
    madeForKids: mode === 'kids',
    containsSyntheticMedia: mode === 'kids' || mode === 'animasi-3d' ? true : syntheticMedia
  }
}

export interface ModeInfo {
  id: ModeId
  label: string
  hint: string
  /** Sudah bisa dipakai di aplikasi. */
  available: boolean
}

/** Daftar mode untuk pemilih di menu Buat. */
export const MODE_INFO: ModeInfo[] = [
  { id: 'fakta-unik', label: 'Fakta Unik', hint: 'Short 30–60 detik dari satu topik', available: true },
  { id: 'alur-cerita', label: 'Alur Cerita', hint: 'Rangkuman film bernarasi', available: false },
  { id: 'animasi-3d', label: 'Animasi 3D', hint: 'Cerita animasi untuk umum', available: false },
  { id: 'kids', label: 'Kids', hint: 'Episode pendek untuk anak', available: false },
  { id: 'asmr-konstruksi', label: 'ASMR Konstruksi', hint: 'Video satisfying', available: false },
  { id: 'bedah-konten', label: 'Bedah Konten', hint: 'Analisis video contoh dan ide', available: false }
]
