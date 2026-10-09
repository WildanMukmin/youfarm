import { readFileSync } from 'node:fs'

// Warna dan font dibaca dari token brand supaya hanya didefinisikan di satu tempat.
const tokens = JSON.parse(readFileSync(new URL('./assets/brand/tokens/tokens.json', import.meta.url), 'utf8'))

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: tokens.color.bg,
        panel: { DEFAULT: tokens.color.panel, 2: tokens.color.panel2 },
        line: { DEFAULT: tokens.color.border, hi: tokens.color.borderHi },
        crimson: { DEFAULT: tokens.color.crimson, hi: tokens.color.crimsonHi, dim: tokens.color.crimsonDim },
        ink: { DEFAULT: tokens.color.text, muted: tokens.color.muted },
        amber: tokens.color.amber,
        ok: tokens.color.ok,
        err: tokens.color.err
      },
      fontFamily: {
        display: [tokens.font.display],
        sans: [tokens.font.body],
        mono: [tokens.font.mono]
      },
      borderRadius: { sm: tokens.radius.sm, md: tokens.radius.md },
      boxShadow: { glow: '0 0 16px rgba(225,29,72,.35)' }
    }
  }
}
