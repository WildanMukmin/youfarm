# YouFarm

Aplikasi desktop (Windows) yang mengubah satu ide menjadi video siap upload YouTube. Pemrosesan lokal, AI lewat API key milik pengguna.

- Rencana dan keputusan desain: [`ide-awal-youfarm.md`](ide-awal-youfarm.md)
- Status pengerjaan: [`docs/progress.md`](docs/progress.md)
- Mockup brand: [`docs/brand-mockup.html`](docs/brand-mockup.html)

## Menjalankan

```bash
npm install
node node_modules/electron/install.js   # bila muncul error "Electron uninstall"
npm run setup:ffmpeg                    # sekali saja: unduh ffmpeg (≈100 MB)
npm run setup:piper                     # sekali saja: unduh Piper dan suara (≈150 MB)
npm run dev
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan aplikasi (hot reload) |
| `npm run build` | Build ke `out/` |
| `npm run typecheck` | Cek tipe main dan renderer |
| `npm test` | Tes unit dan integrasi (ffmpeg dan Piper nyata bila terpasang; Google, Gemini, Pexels palsu) |
| `npm run setup:ffmpeg` / `setup:piper` | Unduh binary dan suara ke `binaries/` dan `models/` (tidak di-commit) |

Data aplikasi ada di `%APPDATA%\youfarm` (database, key dan token terenkripsi).

## Struktur

```
assets/      logo, token brand, font, ikon
src/shared/  tipe dan logika murni (tanpa Electron), termasuk kontrak IPC
src/main/    proses utama: ipc/, platform/, youtube/, modes/
src/renderer UI React: ui/ (komponen dasar), components/, views/, modes/
tests/       tes unit dan integrasi
```

Aturan struktur lengkap ada di lampiran `ide-awal-youfarm.md`.
