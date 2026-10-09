# Status pengerjaan

Diperbarui: 9 Okt 2026 (akhir hari). Pixabay, Groq, Deepgram, dan upload YouTube sudah dicoba pengguna dengan key asli dan berjalan. Acuan rencana: `ide-awal-youfarm.md` (bagian 10, Fase 1 dan 2).

## Sudah jadi dan teruji

| Area | Isi | Teruji |
|---|---|---|
| Kerangka | Electron + electron-vite + React 18 + Tailwind 3, tema dark crimson, sidebar 6 menu, font dibundel | build, typecheck, dijalankan |
| Brand | Logo (Y + Play), wordmark outline, ikon `.ico`, token warna/font | dilihat render-nya |
| Platform | SQLite (sql.js) berversi, key terenkripsi (`safeStorage`), settings, proses anak dengan pembatalan, ffmpeg, Piper | tes unit + app sungguhan |
| Settings | Tab **Umum** (folder, tema) dan **API**: sub-tab per penyedia (Gemini, Groq, Deepgram, ElevenLabs, Pixabay, Pexels), tiap sub-tab berisi tabel key (bisa sampai 10 key: nama, empat karakter terakhir, status, pilih, hapus tanda batas, hapus) dan pilihan **ganti otomatis saat kena batas**. Pilihan penyedia AI dan model tidak ada di Settings lagi | tes unit + app sungguhan (server palsu) |
| Akun | Kredensial Google, OAuth PKCE, banyak channel, Cek akun, Putuskan | Google palsu + app sungguhan |
| Upload | Metadata lengkap, jadwal slot, kuota harian, klasifikasi error, upload resumable, thumbnail, playlist | Google palsu |
| Antrean | Persisten, kuota 6 upload/hari, retry bertingkat, blokir per akun, pulih setelah app ditutup, menu Antrean | tes unit + app sungguhan |
| **Mode Fakta Unik** | Topik → naskah (Gemini atau Groq) → suara (Piper lokal, Gemini TTS, Deepgram, atau ElevenLabs) → footage (Pixabay, atau Pexels) → caption → render 1080x1920 → thumbnail → antrean upload | lihat di bawah |
| Form Fakta Unik | Tab **Konten** (topik, saran topik dari AI per niche, 21 bahasa, durasi, sumber footage, unggah otomatis), **Suara** (sumber dan suara, hanya yang mendukung bahasa terpilih), **Caption** (8 template; font bundel atau Windows, ukuran, kata per tampilan, kapital, tebal, warna teks, sorot kata aktif, garis tepi atau kotak, bayangan, animasi, posisi tegak, rata). Pratinjau caption langsung di bingkai tengah. Pilihan selain topik diingat antar sesi | tes unit + uji menyeluruh (Groq, Deepgram, Pixabay palsu) |
| Satu jalur produksi | Tombol **Buat video** selalu memasukkan ke antrean produksi (satu atau banyak topik); satu video dibuat sekali jalan. Bingkai tengah menampilkan video yang baru dimasukkan, atau yang sedang dibuat, atau yang terbaru (progres, antre, hasil yang bisa diputar), dengan daftar 8 video terbaru di bawahnya; klik untuk berpindah. Panel Naskah dan Publikasi mengikuti video terpilih; "Unggah otomatis" berlaku untuk semua video | uji menyeluruh di app (2 video beruntun, hanya 1 berjalan) + tes unit |
| Publikasi | Privasi bawaan **Publik**; video terjadwal tayang publik di jam tayang. Deskripsi berisi kredit footage | uji menyeluruh (Google palsu menerima `public`) |
| Navigasi per mode | Tiap mode punya menu sendiri di sidebar; mode yang belum ada menampilkan halaman "segera" | app sungguhan |
| Ruang kerja editor | Fakta Unik: panel Input (kiri), pratinjau 9:16 + tahapan + progres + Batal (tengah), Naskah / Publikasi (kanan). Video diputar langsung di aplikasi lewat protokol `youfarm-media://` (bisa seek). Isian form dan proses bertahan saat pindah menu | app sungguhan |
| Akun (tabel) | Kredensial di panel kiri; channel dalam tabel dengan cari, filter status, paginasi 10/25/50 per halaman | app sungguhan, 23 channel palsu |
| Jam tayang per channel | Diatur di menu Akun (panel kanan): preset 1×/2×/3× sehari, tambah/hapus jam, pratinjau slot kosong berikutnya. Panel Publikasi menunjukkan kapan video akan tayang; enqueue memakai jam tayang channel | tes unit + uji menyeluruh (jadwal jatuh tepat 12.00 lokal) |
| Antrean (tab Upload) | Bilah judul dengan Jeda/Lanjutkan (bertahan setelah aplikasi ditutup), tab Upload dan Produksi (segera), deret statistik (tayang berikutnya, menunggu, perlu perhatian, terunggah hari ini) yang bisa diklik sebagai filter, tabel dengan filter status/channel, cari, paginasi, buka di YouTube Studio. Tanpa hitungan kuota lokal | app sungguhan, 18 item palsu |
| Antrean (tab Produksi) | Banyak topik sekaligus (satu per baris, duplikat dibuang, maks 50) dari ruang kerja Fakta Unik; dibuat satu per satu di latar, tersimpan di database, pulih setelah aplikasi ditutup; progres langsung per baris; batal, coba lagi, jeda/lanjut (job yang sedang dibuat kembali antre); judul video yang sudah jadi otomatis masuk daftar "avoid"; opsi "Unggah otomatis" memasukkan video jadi ke antrean upload di jam tayang channel | tes unit + uji menyeluruh (3 video jadi, terjadwal Jum 12.00, Jum 19.00, Sab 12.00) |
| Sidebar | Bisa diciutkan (ikon saja + tooltip) atau dibuka (ikon + label + badge), Ctrl+B, pilihan diingat; badge Antrean merah bila ada yang perlu perhatian | app sungguhan |
| Tanpa scrollbar | Scrollbar disembunyikan di seluruh aplikasi; panel yang lebih panjang dari layar tetap bisa digeser dengan bayangan tepi sebagai penanda; tabel memakai baris "pas layar" dan menyembunyikan kolom kurang penting saat sempit | dicek di 960x600, 1280x800, 1600x900, sidebar terbuka dan ciut |

Perintah: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test` (148 tes), `npm run setup:ffmpeg`, `npm run setup:piper`.

### Yang terbukti di Fakta Unik
- **Nyata**: ffmpeg (render, caption terbakar, thumbnail), Piper (suara Indonesia), antrean, SQLite, enkripsi key, IPC, UI.
- **Palsu (server uji)**: Gemini, Groq, Deepgram, Pixabay, Pexels, Google/YouTube. Bentuk request/respons ditulis dari dokumentasi API, belum dicoba dengan key sungguhan.
- Satu uji menyeluruh di aplikasi: isi form → video 9:16 jadi (≈26 detik, 26 MB) → panel "Masukkan ke antrean" → terjadwal 07.00 besok → diunggah ke Google palsu dengan kategori, bahasa, tags, `selfDeclaredMadeForKids=false`, `containsSyntheticMedia=true`, `publishAt`, dan thumbnail.
- Pindah menu saat video dibuat tidak menghilangkan prosesnya (status disimpan di luar komponen).

## Cara mencoba hari ini (butuh key Anda)

1. `npm run dev`.
2. **Settings > API**: isi key **Gemini** dan **Pixabay** (gratis, dari pixabay.com/api/docs setelah login), lewat tabel key. Pilihan penulis naskah (Gemini atau Groq) dan modelnya ada di form mode (tab Konten); model suara Gemini di tab Suara. Daftar model dimuat otomatis begitu key ada.
3. **Fakta Unik**: isi topik (atau minta saran AI), atur bahasa, suara, dan caption, klik **Buat video**. Video masuk antrean produksi, dibuat satu per satu, dan disimpan di `Videos\YouFarm` (atau folder hasil di Settings > Umum).
4. Untuk upload: **Akun** > isi kredensial Google > Hubungkan channel. Centang **Unggah otomatis** di form, atau kirim dari panel Publikasi video yang sudah jadi.

Bila ada yang gagal, kirim pesan errornya.

## Keputusan yang saya ambil sendiri (silakan diubah)

- **`containsSyntheticMedia` selalu true** untuk Fakta Unik, karena narasi buatan suara AI. Bila Anda menilai suara Piper tidak perlu diungkap, ubah di `pipeline.ts` (`syntheticMedia`).
- **Kata kunci footage berbahasa Inggris** (footage stock paling banyak berbahasa Inggris), apa pun bahasa naskahnya.
- **Bahasa**: 21 bahasa. Gemini TTS mendukung semuanya (bahasa dideteksi dari teks); Deepgram Aura-2 hanya en, es, de, fr, nl, it, ja; Piper hanya bahasa yang modelnya terpasang (id, en). ElevenLabs (Flash v2.5) mendukung semuanya kecuali Jawa, Sunda, dan Thai; daftar suaranya diambil dari akun pengguna lewat API. Ganti bahasa ke yang tidak didukung sumber suara saat ini otomatis pindah ke Gemini TTS.
- **Gemini TTS tetap dipertahankan**: key AI Studio punya jatah gratis untuk model Flash TTS (dicoba pengguna: `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview` jalan; `gemini-2.5-pro-preview-tts` kena 429 karena tanpa tier gratis; `gemini-2.5-flash-preview-tts` menolak kalimat sangat pendek). Ini bukan kredit $300 Google Cloud, yang hanya berlaku bila ditagihkan lewat Cloud.
- **Gemini TTS = satu permintaan per video**: jatah gratis per model sangat kecil (diukur dari respons 429 Google: `gemini-3.8-flash-tts` 3 permintaan per menit, `gemini-3.8-flash-lite-tts` 10 per hari). Memanggil TTS per kalimat (6-7 permintaan per video) cepat menabrak batas itu, jadi seluruh naskah dibacakan sekali lalu WAV-nya dipotong per kalimat di jeda terpanjang yang paling dekat dengan perkiraan posisi dari panjang teks (`src/main/platform/voice/narration-split.ts`). Bila jeda tidak ketemu, batas diperkirakan dan job diberi peringatan. Uji dengan audio asli (id dan en) menghasilkan potongan 3.6-5.2 dtk yang sebanding dengan panjang teksnya; kebenaran titik potong belum didengarkan manusia. Batas per menit Google juga ditunggu lalu dicoba ulang otomatis, dan batas harian gagal dengan pesan yang menyebut modelnya.
- **ElevenLabs**: paket gratis (sekitar 10.000 kredit per bulan) tidak boleh untuk konten komersial, jadi video monetisasi butuh paket Starter. Model tetap `eleven_flash_v2_5` (setengah kredit per karakter). Belum dicoba dengan key asli. Bahasa tanpa spasi (Jepang, Mandarin, Thai) diukur per karakter untuk target durasi dan caption.
- **Waktu sorot kata di caption diperkirakan** dari panjang tiap kata dalam rentang ucapan kalimatnya (tanpa transkripsi). Cukup pas untuk suara sintetis; bisa meleset sedikit di kata yang sangat pendek atau panjang.
- **Huruf yang tidak ada di font caption** (Jepang, Thai, Arab, Hindi, Korea, Mandarin, Kiril) otomatis diambil libass dari font Windows. Sudah dicek dengan render.
- **Saran topik** memakai penulis teks yang dipilih di form mode (Gemini atau Groq) dan menghindari judul yang sudah pernah jadi.
- **Pilihan AI per mode, bukan di Settings**: `textProvider`, `textModel`, dan `ttsModel` adalah bagian dari opsi video (`FaktaUnikOptions`), jadi tersimpan per video di antrean dan diingat antar sesi seperti opsi lain. Settings hanya berisi folder dan tema. Pengguna dari versi sebelumnya perlu memilih model sekali lagi; job lama di antrean tanpa model gagal dengan pesan "Pilih model" dan perlu dibuat ulang.
- **Hapus video = hapus berkasnya**: menghapus video jadi dari antrean produksi juga menghapus mp4, thumbnail, dan SRT dari komputer (`src/main/production/files.ts`), dengan kartu konfirmasi yang menyebut hal itu. Upload yang masih menunggu ikut dibatalkan, upload yang sedang berjalan menolak penghapusan, dan berkas yang sedang diputar membatalkan semuanya dengan pesan jelas. Menghapus item di antrean upload tidak menyentuh berkas. Konfirmasi aksi berisiko di tabel memakai kartu kecil (bukan teks yang memanjang di dalam tombol), dan tombol aksi memakai slot tetap supaya sejajar antar baris.
- **Pustaka footage lokal** (`src/shared/footage.ts`, `src/main/platform/footage-library.ts`, tabel `footage`): klip stock yang diunduh disimpan di `<folder impor>/<penyedia>` (mis. `.../pixabay`; tanpa folder impor di Settings: `userData/import`), dicatat dengan frasa pencarian yang menemukannya, jumlah pakai, dan nomor video terakhir yang memakainya. Per kalimat: (1) pustaka dulu bila ada sedikitnya 3 klip cocok (kemiripan kata kunci ≥ 0.5) yang belum dipakai di video ini dan tidak dipakai dalam 10 video terakhir, kecuali 25% kalimat sengaja bertanya ke penyedia supaya stok segar; (2) penyedia, dengan klip yang baru dipakai dihindari dan pilihan acak di antara 3 klip terbaik (sebelumnya selalu klip teratas yang sama, jadi video berbeda sering mendapat footage identik); (3) bila penyedia gagal (key, kuota, jaringan), klip pustaka yang agak cocok dipakai dengan peringatan, bukan menggagalkan video. Setelah video jadi, kelebihan dari batas ukuran (Settings > Umum, bawaan 5 GB) dibuang mulai dari klip yang paling lama tidak dipakai, kecuali klip video itu. Berkas yang dihapus pengguna dilupakan; Kosongkan hanya menghapus klip yang tercatat. Cache lama (`userData/cache/footage`) dipindah sekali ke pustaka. Catatan: karena jendela 10 video, klip baru bisa dipakai ulang setelah cukup banyak video dengan topik mirip; manfaat awalnya variasi dan cadangan saat penyedia gagal. Syarat API Pixabay soal penyimpanan klip jangka panjang belum dipastikan; lisensi kontennya bebas pakai.
- **Banyak key per penyedia**: nilai tiap key terenkripsi di `secrets.json` (nama `penyedia:id`), sedangkan nama, empat karakter terakhir, key aktif, pilihan ganti otomatis, dan tanda batas ada di `api-keys.json` tanpa nilai key (`src/main/platform/api-keys.ts`, aturan murni di `src/shared/api-keys.ts`). Key tunggal versi lama dimigrasikan jadi "Key 1". Renderer hanya menerima ringkasan, tidak pernah nilai key.
- **Ganti key otomatis**: semua klien (Gemini, Groq, Deepgram, ElevenLabs, Pixabay, Pexels) dibungkus `withRotation` (`src/main/platform/ai/rotation.ts`). Error bertipe kuota atau batas per menit menandai key kena batas (per menit pulih 2 menit, kuota habis 1 jam; bisa dihapus manual) dan permintaan diulang dengan key berikutnya yang siap, berurutan sesuai tabel. Untuk Gemini, batas per menit langsung pindah key tanpa menunggu retryDelay Google. Bila ganti otomatis dimatikan atau semua key kena batas, error asli muncul. Dicoba di app dengan server palsu: key pertama 429 harian, video tetap jadi dengan key kedua.
- **Slot tayang bawaan** 07.00, 12.00, 19.00 waktu lokal untuk channel baru; bisa diubah per channel di menu Akun.
- **Satu jalur produksi** (keputusan pengguna): semua video lewat antrean, satu sekali jalan. Tidak ada lagi pembuatan langsung di luar antrean.
- **Naskah salah bahasa** (Indonesia tertukar Inggris) ditolak dan diminta ulang sekali; ditemukan dari video asli yang naskahnya Inggris padahal dipilih Indonesia.
- **Sumber footage dipilih di form** (bawaan Pixabay). Kredit sumber otomatis masuk deskripsi video, mis. `Footage: Pixabay (pixabay.com)`.
- **Hasil pencarian Pixabay dicache 24 jam** (syarat API Pixabay) di `cache\pixabay-search`, jadi topik yang mirip tidak memanggil API ulang. Batas 100 permintaan per menit: bila tercapai, aplikasi menunggu jendela berikutnya sekali lalu mencoba lagi.
- **Footage Pixabay kebanyakan lanskap**: dipilih rendisi terkecil yang sisi pendeknya ≥ 1080 (biasanya 1920x1080), lalu di-crop tengah ke 9:16. Rendisi di atas 150 MB dilewati.
- **Footage vertikal diutamakan** dan tidak dipakai dua kali dalam satu video. Bila tidak ada footage baru untuk satu kalimat, footage sebelumnya dipakai ulang dengan peringatan.
- **Piper standalone 2023.11.14-2** (satu `piper.exe`), bukan paket Python seperti referensi. Suara: id_ID news_tts dan en_US lessac.
- **Kategori YouTube bawaan Education (27)**, judul dari naskah, deskripsi dari naskah + 3 hashtag.
- **Bitrate tetap 8000 kbps**, belum jadi opsi di form.

## Belum dikerjakan

- **Mode lain**: Alur Cerita (butuh whisper.cpp + pencocokan klip), Animasi 3D, Kids, ASMR, Bedah Konten.
- **Azure Speech** (catatan, belum dibangun): gratis sekitar 500.000 karakter per bulan untuk suara neural termasuk bahasa Indonesia; satu sumber menyebut tier gratis tidak bisa mengekspor audio, jadi cek dulu. **Google Cloud TTS** (Standard 4 juta dan WaveNet 1 juta karakter gratis per bulan, bisa memakai kredit $300) juga kandidat.
- Suara Indonesia open-source yang lebih natural dari Piper: belum ada yang matang untuk CPU tanpa Python (lihat catatan riset di percakapan).
- 3 pilihan judul dari AI, deskripsi dengan chapter, upload caption SRT sebagai track (berkas SRT sudah dibuat, belum diunggah).
- Pembersihan otomatis cache footage (`%APPDATA%\youfarm\cache\footage`) yang akan membesar.
- **Library / galeri video** (ide pengguna): riwayat semua video jadi yang bisa diputar ulang dan dilihat lagi. Sementara, video terbaru ada di daftar bawah bingkai tengah dan semuanya di menu Antrean.
- Opsi unggah otomatis sebagai pribadi dulu (untuk ditinjau sebelum publik); untuk sekarang unggah otomatis mengikuti privasi dan jadwal yang dipilih.
- Channel/project dan Template.
- Dashboard Analitik (izin `yt-analytics.readonly` sudah diminta saat menghubungkan akun).
- Tema terang. Paket produksi: `electron-builder` belum dikonfigurasi (perlu `asarUnpack` untuk wasm `sql.js`, serta menyalin `binaries/`, `models/`, dan font caption ke `resources`). `npm audit` melaporkan 15 temuan, belum diselidiki.

## Catatan teknis

- **Versi**: Vite 7 dan plugin React 4 (electron-vite 5 belum mendukung Vite 8), Tailwind 3, React 18. Sisanya terbaru.
- **Preload CommonJS** (`index.cjs`): renderer ber-sandbox tidak bisa memuat preload ESM.
- **Import relatif ber-ekstensi `.ts`** di file yang dites Node; hindari *parameter properties* TypeScript di sana (Node type-stripping tidak mendukungnya).
- **Windows**: `tar` di PATH bisa GNU tar yang tidak membaca zip, jadi skrip setup memakai `C:\Windows\System32\tar.exe`. `rename` lintas drive gagal (EXDEV), jadi dipakai salin lalu hapus.
- **Kuota**: YouFarm tidak menghitung kuota sendiri (upload punya jatah 100/hari per project sejak 1 Juni 2026). Hanya bereaksi bila Google menolak: `uploadLimitExceeded` menahan channel itu, `quotaExceeded`/`dailyLimitExceeded` menahan semua, keduanya sampai tengah malam Pasifik; rate limit sesaat dicoba ulang.
- **Profil data uji terpisah**: bila salah satu variabel uji di bawah aktif, aplikasi memakai `%APPDATA%\youfarm-test`, bukan `%APPDATA%\youfarm` milik pengguna (bisa diganti dengan `YOUFARM_USER_DATA`). Uji otomatis tidak boleh pernah menyentuh data pengguna.
- **Variabel lingkungan khusus pengembangan** (diabaikan di build rilis): `YOUFARM_FAKE_GOOGLE`, `YOUFARM_FAKE_GEMINI`, `YOUFARM_FAKE_PIXABAY`, `YOUFARM_FAKE_PEXELS`, `YOUFARM_FAKE_GROQ`, `YOUFARM_FAKE_DEEPGRAM` (alamat server palsu), `YOUFARM_AUTH_URL_FILE`, `YOUFARM_QUEUE_GAP="min,max"`, `YOUFARM_DEV_ENQUEUE=1`.
- **Keamanan IPC**: renderer tidak pernah mengirim path berkas. Buka video dan masukkan ke antrean memakai `jobId` yang disimpan di main.

## Usulan langkah berikutnya

1. Pantau kualitas hasil Fakta Unik dari video nyata: jeda antar kalimat, kecepatan suara, pilihan footage, ketepatan waktu sorot kata di caption (waktunya diperkirakan, bukan hasil transkripsi). Bila naskah masih sesekali salah bahasa dengan model tertentu, kirim model dan waktunya.
2. Galeri/riwayat video (menu Library) dan pembersihan cache footage.
3. Mode berikutnya: Animasi 3D atau Alur Cerita (keduanya butuh keputusan Anda di bagian 11 ide awal).
