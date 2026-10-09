/** Penyedia footage stock yang bisa dipilih mode. Murni, dipakai renderer dan main. */
import type { SecretKey } from './settings.ts'

export const STOCK_SOURCES = ['pixabay', 'pexels'] as const
export type StockSource = (typeof STOCK_SOURCES)[number]

export const STOCK_INFO: Record<StockSource, { label: string; key: SecretKey; credit: string }> = {
  pixabay: { label: 'Pixabay', key: 'pixabay', credit: 'Footage: Pixabay (pixabay.com)' },
  pexels: { label: 'Pexels', key: 'pexels', credit: 'Footage: Pexels (pexels.com)' }
}
