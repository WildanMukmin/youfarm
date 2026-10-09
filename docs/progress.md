# Status pengerjaan

Diperbarui: 9 Okt 2026. Acuan rencana: `ide-awal-youfarm.md` (bagian 10, Fase 1 dan 2).

## Sudah jadi dan teruji

| Area | Isi | Teruji |
|---|---|---|
| Kerangka | Electron + electron-vite + React 18 + Tailwind 3, tema dark crimson, sidebar 6 menu, font dibundel | build, typecheck, dijalankan |
| Brand | Logo (Y + Play), wordmark outline, ikon `.ico`, token warna/font | dilihat render-nya |
| Platform | SQLite (sql.js) berversi, key terenkripsi (`safeStorage`), settings, proses anak dengan pembatalan, ffmpeg, Piper | tes unit + app sungguhan |
| Settings | Tab **Umum** (folder, tema) dan **API** (key, provider teks, model Gemini teks dan TTS) | app sungguhan |
| Akun | Kredensial Google, OAuth PKCE, banyak channel, Cek akun, Putuskan | Google palsu + app sungguhan |
| Upload | Metadata lengkap, jadwal slot, kuota harian, klasifikasi error, upload resumable, thumbnail, playlist | Google palsu |
| Antrean | Persisten, kuota 6 upload/hari, retry bertingkat, blokir per akun, pulih setelah app ditutup, menu Antrean | tes unit + app sungguhan |
| **Mode Fakta Unik** | Topik → naskah (Gemini) → suara (Piper lokal atau Gemini TTS) → footage (Pexels) → caption → render 1080x1920 → thumbnail → antrean upload | lihat di bawah |
| Navigasi per mode | Tiap mode punya menu sendiri di sidebar; mode yang belum ada menampilkan halaman "segera" | app sungguhan |
| Ruang kerja editor | Fakta Unik: panel Input (kiri), pratinjau 9:16 + tahapan + progres + Batal (tengah), Naskah / Publikasi (kanan). Video diputar langsung di aplikasi lewat protokol `youfarm-media://` (bisa seek). Isian form dan proses bertahan saat pindah menu | app sungguhan |
| Akun (tabel) | Kredensial di panel kiri; channel dalam tabel dengan cari, filter status, paginasi 10/25/50 per halaman | app sungguhan, 23 channel palsu |
| Jam tayang per channel | Diatur di menu Akun (panel kanan): preset 1×/2×/3× sehari, tambah/hapus jam, pratinjau slot kosong berikutnya. Panel Publikasi menunjukkan kapan video akan tayang; enqueue memakai jam tayang channel | tes unit + uji menyeluruh (jadwal jatuh tepat 12.00 lokal) |
| Antrean (tab Upload) | Bilah judul dengan Jeda/Lanjutkan (bertahan setelah aplikasi ditutup), tab Upload dan Produksi (segera), deret statistik (tayang berikutnya, menunggu, perlu perhatian, terunggah hari ini) yang bisa diklik sebagai filter, tabel dengan filter status/channel, cari, paginasi, buka di YouTube Studio. Tanpa hitungan kuota lokal | app sungguhan, 18 item palsu |
| Antrean (tab Produksi) | Banyak topik sekaligus (satu per baris, duplikat dibuang, maks 50) dari ruang kerja Fakta Unik; dibuat satu per satu di latar, tersimpan di database, pulih setelah aplikasi ditutup; progres langsung per baris; batal, coba lagi, jeda/lanjut (job yang sedang dibuat kembali antre); judul video yang sudah jadi otomatis masuk daftar "avoid"; opsi "Unggah otomatis" memasukkan video jadi ke antrean upload di jam tayang channel | tes unit + uji menyeluruh (3 video jadi, terjadwal Jum 12.00, Jum 19.00, Sab 12.00) |
| Sidebar | Bisa diciutkan (ikon saja + tooltip) atau dibuka (ikon + label + badge), Ctrl+B, pilihan diingat; badge Antrean merah bila ada yang perlu perhatian | app sungguhan |
| Tanpa scrollbar | Scrollbar disembunyikan di seluruh aplikasi; panel yang lebih panjang dari layar tetap bisa digeser dengan bayangan tepi sebagai penanda; tabel memakai baris "pas layar" dan menyembunyikan kolom kurang penting saat sempit | dicek di 960x600, 1280x800, 1600x900, sidebar terbuka dan ciut |

Perintah: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test` (108 tes), `npm run setup:ffmpeg`, `npm run setup:piper`.

### Yang terbukti di Fakta Unik
- **Nyata**: ffmpeg (render, caption terbakar, thumbnail), Piper (suara Indonesia), antrean, SQLite, enkripsi key, IPC, UI.
- **Palsu (server uji)**: Gemini, Pexels, Google/YouTube. Bentuk request/respons ditulis dari dokumentasi API, belum dicoba dengan key sungguhan.
- Satu uji menyeluruh di aplikasi: isi form → video 9:16 jadi (≈26 detik, 26 MB) → panel "Masukkan ke antrean" → terjadwal 07.00 besok → diunggah ke Google palsu dengan kategori, bahasa, tags, `selfDeclaredMadeForKids=false`, `containsSyntheticMedia=true`, `publishAt`, dan thumbnail.
- Pindah menu saat video dibuat tidak menghilangkan prosesnya (status disimpan di luar komponen).

## Cara mencoba hari ini (butuh key Anda)

1. `npm run dev`.
2. **Settings > API**: isi key **Gemini** dan **Pexels**, klik **Muat daftar model**, pilih model teks. (Model TTS hanya bila memakai suara Gemini.)
3. **Buat**: isi topik, pilih Piper, klik **Buat video**. Video disimpan di `Videos\YouFarm` (atau folder hasil di Settings > Umum).
4. Untuk upload: **Akun** > isi kredensial Google > Hubungkan channel, lalu di hasil klik **Masukkan ke antrean upload**.

Bila ada yang gagal, kirim pesan errornya. Titik paling mungkin: bentuk respons Gemini/Pexels yang sedikit berbeda dari dokumentasi.

## Keputusan yang saya ambil sendiri (silakan diubah)

- **`containsSyntheticMedia` selalu true** untuk Fakta Unik, karena narasi buatan suara AI. Bila Anda menilai suara Piper tidak perlu diungkap, ubah di `pipeline.ts` (`syntheticMedia`).
- **Kata kunci footage berbahasa Inggris** (footage stock paling banyak berbahasa Inggris), walau naskah bahasa Indonesia.
- **Slot tayang bawaan** 07.00, 12.00, 19.00 waktu lokal untuk semua channel (`modes.ipc.ts`). Pengaturan per channel belum ada UI-nya.
- **Footage vertikal diutamakan** dan tidak dipakai dua kali dalam satu video. Bila tidak ada footage baru untuk satu kalimat, footage sebelumnya dipakai ulang dengan peringatan.
- **Piper standalone 2023.11.14-2** (satu `piper.exe`), bukan paket Python seperti referensi. Suara: id_ID news_tts dan en_US lessac.
- **Kategori YouTube bawaan Education (27)**, judul dari naskah, deskripsi dari naskah + 3 hashtag.
- **Bitrate tetap 8000 kbps**, belum jadi opsi di form.

## Belum dikerjakan

- **Mode lain**: Alur Cerita (butuh whisper.cpp + pencocokan klip), Animasi 3D, Kids, ASMR, Bedah Konten.
- Provider **Groq untuk naskah** (Settings bisa memilihnya, tetapi mode menolak dengan pesan jelas). Suara Deepgram/ElevenLabs.
- 3 pilihan judul dari AI, deskripsi dengan chapter, upload caption SRT sebagai track (berkas SRT sudah dibuat, belum diunggah).
- Pembersihan otomatis cache footage (`%APPDATA%\youfarm\cache\pexels`) yang akan membesar.
- UI slot jam tayang per channel, Library, Channel/project, Template, Auto-ide, Batch produksi.
- Dashboard Analitik (izin `yt-analytics.readonly` sudah diminta saat menghubungkan akun).
- Tema terang. Paket produksi: `electron-builder` belum dikonfigurasi (perlu `asarUnpack` untuk wasm `sql.js`, serta menyalin `binaries/`, `models/`, dan font caption ke `resources`). `npm audit` melaporkan 15 temuan, belum diselidiki.

## Catatan teknis

- **Versi**: Vite 7 dan plugin React 4 (electron-vite 5 belum mendukung Vite 8), Tailwind 3, React 18. Sisanya terbaru.
- **Preload CommonJS** (`index.cjs`): renderer ber-sandbox tidak bisa memuat preload ESM.
- **Import relatif ber-ekstensi `.ts`** di file yang dites Node; hindari *parameter properties* TypeScript di sana (Node type-stripping tidak mendukungnya).
- **Windows**: `tar` di PATH bisa GNU tar yang tidak membaca zip, jadi skrip setup memakai `C:\Windows\System32\tar.exe`. `rename` lintas drive gagal (EXDEV), jadi dipakai salin lalu hapus.
- **Kuota**: YouFarm tidak menghitung kuota sendiri (upload punya jatah 100/hari per project sejak 1 Juni 2026). Hanya bereaksi bila Google menolak: `uploadLimitExceeded` menahan channel itu, `quotaExceeded`/`dailyLimitExceeded` menahan semua, keduanya sampai tengah malam Pasifik; rate limit sesaat dicoba ulang.
- **Profil data uji terpisah**: bila salah satu variabel uji di bawah aktif, aplikasi memakai `%APPDATA%\youfarm-test`, bukan `%APPDATA%\youfarm` milik pengguna (bisa diganti dengan `YOUFARM_USER_DATA`). Uji otomatis tidak boleh pernah menyentuh data pengguna.
- **Variabel lingkungan khusus pengembangan** (diabaikan di build rilis): `YOUFARM_FAKE_GOOGLE`, `YOUFARM_FAKE_GEMINI`, `YOUFARM_FAKE_PEXELS` (alamat server palsu), `YOUFARM_AUTH_URL_FILE`, `YOUFARM_QUEUE_GAP="min,max"`, `YOUFARM_DEV_ENQUEUE=1`.
- **Keamanan IPC**: renderer tidak pernah mengirim path berkas. Buka video dan masukkan ke antrean memakai `jobId` yang disimpan di main.

## Usulan langkah berikutnya

1. Coba alur di atas dengan key sungguhan dan kabari hasilnya (terutama bentuk respons Gemini dan Pexels).
2. Rapikan kualitas hasil Fakta Unik dari video nyata: jeda antar kalimat, kecepatan suara, pilihan footage.
3. Mode berikutnya: Animasi 3D atau Alur Cerita (keduanya butuh keputusan Anda di bagian 11 ide awal).
