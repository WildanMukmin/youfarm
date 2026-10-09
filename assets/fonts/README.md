# Fonts

Dibundel lokal supaya aplikasi jalan tanpa internet. Semua berlisensi SIL OFL (berkas `OFL.txt` ada di tiap folder). Subset latin saja.

| Keluarga | Bobot | Folder |
|---|---|---|
| Chakra Petch | 600, 700 | `chakra-petch/` |
| IBM Plex Sans | 400, 500, 600 | `ibm-plex-sans/` |
| JetBrains Mono | 400, 500, 700 | `jetbrains-mono/` |

`fonts.css` mendefinisikan `@font-face` dan diimpor di `renderer/src/index.css`. Untuk menambah bobot, salin `.woff2` dari paket `@fontsource/<nama>` (folder `files/`) lalu tambah satu baris di `fonts.css`.

## Font caption (`caption/`)

TTF utuh (bukan subset) untuk dibakar ke video lewat libass, dan dipakai juga oleh pratinjau caption di aplikasi.
Huruf yang tidak ada di font ini (mis. aksara Jepang atau Thai) otomatis diambil dari font Windows oleh libass.

| Keluarga | Berkas | Lisensi |
|---|---|---|
| Poppins | `Poppins-Bold.ttf` | SIL OFL (`OFL-Poppins.txt`) |
| Poppins Black | `Poppins-Black.ttf` | SIL OFL (`OFL-Poppins.txt`) |
| Anton | `Anton-Regular.ttf` | SIL OFL (`OFL-Anton.txt`) |
| Bebas Neue | `BebasNeue-Regular.ttf` | SIL OFL (`OFL-BebasNeue.txt`) |
| Archivo Black | `ArchivoBlack-Regular.ttf` | SIL OFL (`OFL-ArchivoBlack.txt`) |
| Bangers | `Bangers-Regular.ttf` | SIL OFL (`OFL-Bangers.txt`) |
| Luckiest Guy | `LuckiestGuy-Regular.ttf` | Apache 2.0 (`LICENSE-LuckiestGuy.txt`) |

Sumber: repo github.com/google/fonts. Nama keluarga di tabel harus sama dengan `CAPTION_FONTS` di `src/shared/captions.ts`.
