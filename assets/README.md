# Assets

Semua berkas non-kode milik YouFarm.

| Folder | Isi | Status |
|---|---|---|
| `brand/` | Logo, token warna dan tipografi | Logo dasar dan token sudah ada |
| `fonts/` | Berkas font `.woff2` yang dibundel lokal | Kosong, lihat `fonts/README.md` |
| `icons/app/` | Ikon aplikasi Windows (`icon.ico`, `icon.png`) | Kosong |
| `icons/modes/` | Ikon SVG tiap mode (6 mode) | Kosong |
| `images/placeholders/` | Gambar pengganti (thumbnail kosong, avatar channel) | Kosong |
| `audio/sfx/` | Efek suara bawaan (notifikasi, sound design ASMR) | Kosong |

Aturan:
- Hanya aset yang dipakai aplikasi. Hasil render, model, dan binary tidak disimpan di sini (`binaries/`, `models/`, folder hasil pengguna).
- SVG diutamakan untuk ikon dan logo. Pastikan lisensi tiap font, gambar, dan audio mengizinkan distribusi dalam aplikasi.
- Saat build, berkas yang dipakai renderer disalin atau diimpor dari sini ke `src/renderer`.
