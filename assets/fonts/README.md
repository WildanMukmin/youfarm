# Fonts

Dibundel lokal supaya aplikasi jalan tanpa internet. Semua berlisensi SIL OFL (berkas `OFL.txt` ada di tiap folder). Subset latin saja.

| Keluarga | Bobot | Folder |
|---|---|---|
| Chakra Petch | 600, 700 | `chakra-petch/` |
| IBM Plex Sans | 400, 500, 600 | `ibm-plex-sans/` |
| JetBrains Mono | 400, 500, 700 | `jetbrains-mono/` |

`fonts.css` mendefinisikan `@font-face` dan diimpor di `renderer/src/index.css`. Untuk menambah bobot, salin `.woff2` dari paket `@fontsource/<nama>` (folder `files/`) lalu tambah satu baris di `fonts.css`.
