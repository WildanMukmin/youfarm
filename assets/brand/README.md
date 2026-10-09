# Brand

Sumber kebenaran brand YouFarm. Mockup visual: `docs/brand-mockup.html`.

- `logo/`: logo dan ikon (SVG)
- `tokens/tokens.json`: nilai warna, font, radius
- `tokens/tokens.css`: variabel CSS yang sama

Saat aplikasi dibuat, `tailwind.config.js` membaca `tokens.json` supaya warna hanya didefinisikan di satu tempat. Ubah nilai di sini, bukan di komponen.

Aturan warna:
- `crimson` (`#E11D48`) hanya untuk fill aksi utama, glow, progress. Bukan teks kecil (kontras sekitar 4.1:1).
- Teks aksen memakai `crimson-hi`.
- Error memakai `err` (coral), bukan crimson.
