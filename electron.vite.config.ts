import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const root = import.meta.dirname
const shared = resolve(root, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
    build: { rollupOptions: { input: { index: resolve(root, 'src/main/index.ts') } } }
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    // Preload dibuat CommonJS: renderer ber-sandbox tidak bisa memuat preload ESM.
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/main/preload.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(root, 'src/renderer/src'),
        '@shared': shared,
        '@assets': resolve(root, 'assets')
      }
    },
    server: { fs: { allow: [root] } },
    build: { rollupOptions: { input: resolve(root, 'src/renderer/index.html') } }
  }
})
