# YouFarm: Ide Awal

Aplikasi desktop (Windows) yang mengubah satu ide menjadi video siap upload untuk beberapa niche konten. Semua pemrosesan berjalan lokal, AI lewat API key milik pengguna, posting ke YouTube langsung dari aplikasi.

Referensi: project `D:\project\clipper-cuan` (Electron + React + ffmpeg). YouFarm **bukan** clipper dan tidak memuat fitur Auto Clip. Kode ditulis **baru dari nol**; `clipper-cuan` hanya dibaca untuk pola dan pelajaran, tidak disalin.

Mockup brand (palet, tipografi, komponen): [`docs/brand-mockup.html`](docs/brand-mockup.html).

---

## 1. Mode konten

Ada enam mode. Lima mode membuat video, satu mode (Bedah Konten) menganalisis.

| Mode | Input | Output | Pola di clipper-cuan |
|---|---|---|---|
| **Alur Cerita** | File film | Video rangkuman bernarasi per part, multi-rasio | `main/story-recap.ts`, `shared/story-recap.ts` |
| **Fakta Unik** | Niche atau topik | Short 30–60 detik | `main/faceless-*.ts`, `shared/faceless*.ts` |
| **Animasi 3D** | Tema, karakter, genre | Cerita animasi 3D untuk audiens umum | Belum ada polanya, perlu visual AI |
| **Kids** (kucing lucu, 3D) | Karakter dan tema | Episode pendek untuk anak | Belum ada polanya, perlu visual AI |
| **ASMR Konstruksi** | Jenis proyek | Video satisfying dengan sound design | Belum ada polanya, minim narasi |
| **Bedah Konten** | Link YouTube contoh | Analisis konten + ide serupa yang dioptimasi | Belum ada polanya |

Rangkuman film dan alur cerita adalah satu mode (**Alur Cerita**).

**Animasi 3D vs Kids.** Gaya visualnya mirip, tetapi Animasi 3D untuk penonton umum (cerita, humor, drama ringan, edukasi). Perbedaannya di kepatuhan YouTube: Kids otomatis `madeForKids: true`, Animasi 3D `false`. Keduanya memakai `containsSyntheticMedia: true`. Karena aturan dan gaya naskahnya berbeda, keduanya tetap mode terpisah.

### Bedah Konten

Mode analisis, bukan mode produksi.

1. Pengguna menempel link video YouTube sebagai contoh.
2. Gemini membedah: hook, struktur, pacing, pola judul dan thumbnail, alasan video itu berhasil, dan kelemahannya.
3. Aplikasi mengusulkan beberapa ide konten serupa dengan optimasi lanjutan.
4. Tombol **"Buat dengan mode X"** mengirim ide terpilih ke mode produksi, dengan topik dan preset terisi.

Catatan:
- Input ke Gemini bisa URL YouTube langsung, atau transkrip + metadata dari Data API sebagai cadangan.
- Ide yang dihasilkan harus **orisinal**, bukan salinan. Ini juga menjaga dari masalah inauthentic content.
- Rincian fitur dibahas terpisah sebelum dikerjakan.

## 2. Pipeline: independen per mode

Tiap mode punya pipeline sendiri, lengkap dari naskah sampai render. Mengubah satu mode tidak boleh mempengaruhi mode lain.

```
Ide → Naskah → Visual → Suara → Caption → Render → Thumbnail → (hasil siap upload)
```

Urutan di atas hanya pola umum. Tiap mode bebas mengubah, menambah, atau membuang langkah.

Aturan pemisahan:

- Setiap mode hidup di foldernya sendiri (tipe, logika naskah, visual, suara, render, form UI). Mode **tidak boleh mengimpor** dari mode lain.
- Yang boleh dipakai bersama hanya **layanan platform** yang tidak berubah-ubah bentuknya:
  - klien API (Gemini, Groq, Deepgram, Pexels, TTS)
  - helper `spawn-process` dan penjalan ffmpeg
  - database, settings, dan penyimpanan key terenkripsi
  - modul YouTube (akun, upload, kuota, jadwal, analitik)
  - komponen UI dasar
- Konsekuensi yang diterima: ada logika serupa yang terduplikasi antar mode (misalnya pembuatan caption). Ini dipilih sengaja supaya update mode tidak merusak mode lain. Bila suatu bagian terbukti identik di semua mode dan stabil, baru dipindah ke platform.
- Output tiap mode adalah **kontrak yang sama**: `RenderedVideo` (file, durasi, rasio, naskah, mode, template). Antrean, Library, dan Upload hanya mengenal kontrak ini, bukan isi pipeline.

Sumber visual per mode (masing-masing modul milik mode itu sendiri):

| Sumber visual | Dipakai oleh |
|---|---|
| Potongan film yang cocok dengan narasi | Alur Cerita |
| Footage stock (Pexels) | Fakta Unik, ASMR |
| Gambar AI (bisa dianimasikan) | Kids, Animasi 3D, Fakta Unik |
| Video AI | Kids, Animasi 3D, ASMR |

Mode baru = folder baru + satu entri di daftar mode. Tidak ada mode lain yang disentuh.

## 3. Fitur "farm" di atas mode

Ini yang membedakan YouFarm dari generator video biasa: produksi berskala, bukan satu video lalu selesai.

- **Batch queue**: masukkan banyak ide sekaligus (mis. 20). Render berjalan satu per satu di latar dan dilanjutkan setelah aplikasi dibuka lagi.
- **Channel / project**: tiap channel punya niche, suara, gaya caption, dan jadwal sendiri. Contoh: channel A (fakta unik, suara pria, caption kuning, tayang 07.00 dan 19.00) terpisah dari channel B (kids, suara ceria).
- **Template**: simpan setelan satu niche sekali, pakai ulang.
- **Auto-ide**: "buatkan N ide" dengan daftar `avoid` berisi ide yang pernah dipakai, supaya tidak berulang.
- **Library**: riwayat video yang sudah dibuat, bisa dibuka, dijadwalkan ulang, atau dihapus ke Recycle Bin.

## 4. Menu Akun

Fungsinya mengikuti menu **Akun** di referensi (`renderer/src/AccountsView.tsx`, `main/youtube-account.ts`):

- Pengguna membuat app developer Google Cloud sendiri, lalu memasukkan Client ID dan Client Secret.
- **Hubungkan** channel YouTube lewat OAuth PKCE (loopback ke browser). Bisa lebih dari satu channel.
- Per channel tampil: nama, status (aktif, perlu hubungkan ulang, perlu izin analitik), kapan token kedaluwarsa, jumlah video yang sudah diposting.
- **Cek akun**: uji token tanpa upload.
- **Putuskan**: mencabut akses di Google dan menghapus token lokal.
- Client Secret dan token dienkripsi dengan `safeStorage`, hanya dipakai di main process, tidak pernah dikirim ke jendela antarmuka.
- Kalau YouFarm dijual: tambah bagian **Lisensi** (sekali bayar, satu kunci per komputer) seperti `LicenseGate.tsx` di referensi. Keputusan ini belum final.

Rincian akan menyesuaikan seiring pengembangan.

## 5. Settings umum

Settings hanya berisi pengaturan umum, dibagi dalam **tab** supaya tidak panjang ke bawah. Pengaturan teknis (rasio, bitrate, gaya caption, suara, transkripsi) **tidak** di sini: itu opsi tiap mode, dipilih di form mode (Input) atau di template.

| Tab | Kartu | Isi |
|---|---|---|
| **Umum** | Penyimpanan | Folder impor dan folder hasil |
| | Tampilan | Tema (gelap default; terang dan ikuti sistem menyusul) |
| **API** | API key | Gemini, Groq, Deepgram, Pexels, ElevenLabs. Disimpan terenkripsi, status "sudah diisi" tampil tanpa menampilkan nilainya |
| | Penyedia AI | Provider teks (Gemini atau Groq) dan model Gemini untuk teks (dibaca dari API pakai key pengguna) |

Prinsip dari referensi: provider cloud hanya bisa dipilih bila key-nya sudah diisi. Aturan ini berlaku juga untuk opsi suara dan transkripsi di tiap mode. Tab baru ditambah bila ada kebutuhan umum baru (mis. Lisensi), bukan untuk opsi mode.

## 6. Upload YouTube: optimasi dari referensi

Yang sudah baik di referensi dan **dipertahankan** (ditulis ulang, polanya sama): upload resumable, antrean jadwal dengan jeda acak antar upload, klasifikasi error (`retry` / `quota` / `account` / `item`), refresh token otomatis, upload yang terputus kembali ke antrean.

Yang kurang di referensi dan **dioptimasi** di YouFarm:

| Masalah di referensi | Perbaikan di YouFarm |
|---|---|
| `categoryId` dikunci `"22"` | Kategori per channel/niche (Education, Entertainment, dll.) |
| Tidak ada tags dan bahasa | Tags, `defaultLanguage`, `defaultAudioLanguage` dibuat AI dari naskah |
| Judul, deskripsi diketik manual | AI membuat 3 pilihan judul, deskripsi dengan chapter, hashtag, dari naskah yang sudah ada |
| `selfDeclaredMadeForKids: false` dikunci | Per mode: **otomatis `true` untuk mode Kids**, `false` untuk sisanya (termasuk Animasi 3D) |
| Tidak ada pengungkapan AI | Set `containsSyntheticMedia` otomatis untuk konten sintetis |
| Satu channel per jadwal | Antrean multi-channel, tiap channel punya slot jam tayang sendiri (mis. 07.00, 12.00, 19.00) |
| Jadwal harus dipilih tangan | Auto-slot: sistem mengisi slot kosong berikutnya, tetap menghormati batas minimal 15 menit |
| Tidak ada playlist | Masukkan ke playlist per seri/niche |
| Tidak ada caption terunggah | Unggah caption (SRT) sebagai track, bukan hanya dibakar ke video |
| Thumbnail terpisah | Thumbnail dibuat otomatis dari frame terbaik + hook, lalu diunggah bersama video |
| Kuota tidak terlihat | Penghitung kuota harian (upload = 1.600 unit dari 10.000), antrean berhenti rapi saat habis dan lanjut besok |
| Video gagal hanya diberi pesan | Layar "Perlu perhatian": kesalahan, penyebab, tombol coba lagi |

Pembaruan metadata setelah upload (judul, deskripsi, thumbnail) memakai `videos.update` dan `thumbnails.set`.

## 7. Dashboard Analitik YouTube

Satu menu sendiri di sidebar. Di bagian atas ada **pemilih akun** (dropdown berisi channel dari menu Akun). Mengganti akun mengganti seluruh isi dashboard. Pilihan terakhir diingat.

**Tampilan:**

| Bagian | Isi |
|---|---|
| Pemilih akun + rentang waktu | 7 hari, 28 hari, 90 hari, 1 tahun, atau rentang sendiri. Ada opsi "bandingkan dengan periode sebelumnya" |
| Kartu ringkasan | Views, watch time, rata-rata durasi tonton, subscriber baru (bersih), likes, komentar |
| Grafik tren | Views dan watch time per hari |
| Video teratas | Tabel video dengan views, watch time, rata-rata persentase ditonton, CTR bila tersedia |
| Sumber trafik | Browse, Suggested, Search, Shorts feed, External |
| Audiens | Negara, usia, dan gender |
| Retensi | Kurva retensi per video yang dipilih |
| Pendapatan | Muncul hanya bila channel sudah dimonetisasi dan izin pendapatan diberikan |
| Banding channel | Tabel ringkas semua channel yang terhubung, urut dari yang terbaik |

**Nilai tambah khas YouFarm (umpan balik ke produksi):**

- Setiap video yang diunggah dari YouFarm menyimpan `videoId`, mode, template, dan channel-nya. Dashboard bisa menjawab: **mode, template, dan suara mana yang performanya paling bagus**.
- Tombol "Buat lagi seperti ini" pada video teratas: membuka mode terkait dengan preset yang sama dan meminta AI membuat ide serupa.
- Menandai video yang jelek (retensi turun di awal) supaya hook-nya bisa diperbaiki.

**Teknis:**

- Memakai **YouTube Analytics API** (`youtubeAnalytics.reports.query`) untuk metrik dan **Data API** untuk judul, thumbnail, dan statistik video.
- Butuh scope tambahan: `yt-analytics.readonly`, dan `yt-analytics-monetary.readonly` hanya bila pengguna mengaktifkan tab pendapatan. Akun yang sudah terhubung sebelumnya harus **dihubungkan ulang** untuk memberi izin baru, jadi menu Akun menampilkan status "perlu izin analitik".
- Data analitik terlambat sekitar 2–3 hari. Dashboard menandai hari terakhir yang belum final.
- Hasil query disimpan di SQLite per channel dan rentang waktu. Dashboard terbuka instan dari cache, lalu menyegarkan di latar, dengan tombol "Segarkan" manual. Ini menghemat kuota dan membuat dashboard bisa dibuka tanpa internet.
- Pengambilan data berjalan di main process memakai token yang sudah ada. Renderer hanya menerima angka yang sudah diolah.
- Data dan token tiap channel dipisah. Menghapus akun dari menu Akun juga menghapus cache analitiknya.

## 8. Arah UI: merah dark futuristik

Mockup lengkap ada di [`docs/brand-mockup.html`](docs/brand-mockup.html). Token di bawah sama dengan yang ada di mockup.

**Palet**

| Token | Hex | Pakai untuk |
|---|---|---|
| Void | `#0B0709` | Latar utama |
| Panel | `#14090C` | Kartu, sidebar |
| Panel 2 | `#1B0D11` | Hover, langkah aktif |
| Border | `#2A1217` | Garis halus, grid latar |
| Crimson | `#E11D48` | Fill aksi utama, glow, progress |
| Crimson Hi | `#FF5C7A` | Teks aksen, ikon aktif (kontras cukup di atas Void) |
| Teks | `#F5EBED` | Teks utama |
| Muted | `#A59298` | Teks sekunder |
| Amber | `#F5B83D` | Peringatan, kuota tinggi |
| Cyan | `#2DD4BF` | Selesai, sukses |
| Coral | `#FF8A5B` | Error (sengaja berbeda dari crimson agar tidak tertukar dengan aksi utama) |

Catatan kontras: `#E11D48` di atas Void hanya sekitar 4.1:1, jadi dipakai untuk fill dan glow, bukan teks kecil. Teks aksen memakai `#FF5C7A`.

**Tipografi**
- Judul dan heading: Chakra Petch (600/700)
- Isi: IBM Plex Sans (400/500/600)
- Angka, timer, antrean, kuota: JetBrains Mono
- Di aplikasi final font dibundel lokal, bukan dari CDN.

**Gaya**
- Glow tipis di elemen aktif, grid halus di latar, sudut agak tajam (6–8px).
- Sidebar ikon dua grup. **Mode**: Fakta Unik · Alur Cerita · Animasi 3D · Kids · ASMR · Bedah Konten (tiap mode menu sendiri, tidak dicampur dalam satu menu "Buat"). **Alat**: Antrean · Library · Analitik · Akun · Settings.
- **Tata letak editor, bukan kartu memanjang**: bilah judul di atas, panel kiri (Input), area kerja di tengah (pratinjau 9:16, progres, hasil), panel kanan (Naskah / Publikasi). Tiap panel ber-scroll sendiri; halaman tidak memanjang ke bawah.
- Data yang bisa banyak (channel di menu Akun, nanti juga antrean dan library) ditampilkan sebagai **tabel dengan cari, filter, dan paginasi**.
- Alur tiap mode tetap **Input → Proses → Hasil**, kini sebagai panel kiri → tengah → kanan. Pola ini diambil dari `DESIGN.md` referensi; gaya visualnya **tidak** diambil.

## 9. Risiko

- **Alur Cerita**: potongan film dilindungi hak cipta. Fitur andalan sebaiknya mengarah ke film milik sendiri, domain publik, atau berizin, dengan peringatan jelas di UI.
- **Kids**: aturan YouTube untuk konten anak ketat (tanpa komentar, iklan terbatas, kualitas dan keamanan konten).
- **Inauthentic content**: video massal yang repetitif bisa gagal monetisasi. Template boleh sama, isi tiap video harus berbeda. Berlaku juga untuk ide dari Bedah Konten: ide harus orisinal, bukan tiruan video contoh.
- **Biaya video AI** adalah komponen terbesar untuk Kids, Animasi 3D, dan ASMR. Mulai dari stock atau gambar AI dulu.
- **Kuota API** (Pexels 200 request/jam, YouTube 10.000 unit/hari, Gemini sesuai paket key pengguna) harus ditangani di antrean.
- **Izin analitik** menambah scope OAuth. Bila app Google Cloud pengguna masih mode Testing, token kedaluwarsa tiap 7 hari, jadi dashboard perlu menampilkan ajakan hubungkan ulang dengan jelas.
- **Duplikasi antar mode** (konsekuensi pipeline independen): perbaikan bug umum harus dilakukan di tiap mode. Dikelola dengan tes per mode dan memindahkan bagian yang terbukti identik dan stabil ke platform.

## 10. Urutan pengerjaan

1. **Fase 1**: kerangka aplikasi, layanan platform (db, settings, API key, spawn-process, ffmpeg), mode **Fakta Unik** dan **Alur Cerita**, Settings, menu Akun, upload YouTube dasar.
2. **Fase 2**: batch queue, channel, template, upload YouTube yang dioptimasi (bagian 6), **dashboard analitik** (bagian 7), mode **Bedah Konten** (hanya butuh Gemini dan link, tanpa render).
3. **Fase 3**: mode **Animasi 3D**, **Kids**, dan **ASMR** (visual AI).
4. **Fase 4**: platform lain (TikTok, Reels), lisensi bila dijual.

## 11. Keputusan

Sudah diputuskan:
- Kode **ditulis baru dari nol**, referensi hanya untuk pola.
- Pipeline **independen per mode**.
- Mode keenam **Bedah Konten** dan mode **Animasi 3D** ditambahkan.

Belum final:
1. Sumber film Alur Cerita: file lokal saja, atau juga link.
2. Dipakai sendiri atau dijual (menentukan perlu tidaknya lisensi dan server lisensi).
3. Rincian fitur Bedah Konten (output analisis, format ide, cara kirim ke mode lain).

---

## Lampiran: saran struktur project

Satu repo, satu aplikasi Electron. Tidak ada landing page atau server di tahap awal (referensi memisahkannya jadi tiga folder, YouFarm belum perlu).

Prinsip struktur: **platform** (dipakai semua), **modes** (terisolasi satu sama lain), **ipc** (satu file per domain), **ui** (komponen reusable).

```text
youfarm/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json  tsconfig.node.json  tsconfig.web.json
├── tailwind.config.js  postcss.config.js
├── assets/                        brand/ (logo, tokens), fonts/, icons/, images/, audio/
├── scripts/                       setup binary dan model (ffmpeg, whisper.cpp, yt-dlp bila perlu, Piper)
├── binaries/  models/             tidak di-commit
├── tests/                         tes per mode dan per modul platform
├── docs/
│   ├── brand-mockup.html          mockup brand
│   └── modes/                     catatan desain per mode
└── src/
    ├── shared/                    tipe dan fungsi murni, tanpa Electron/Node, mudah dites
    │   ├── ipc-channels.ts        nama channel + tipe parameter/hasil (kontrak IPC)
    │   ├── contracts/             RenderedVideo, ModeDefinition, JobStatus
    │   ├── youtube/               metadata, jadwal, kuota, slot, analytics (rentang, agregasi)
    │   └── settings.ts
    ├── main/                      proses utama (Node)
    │   ├── index.ts               jendela, protokol media, memasang semua handler IPC
    │   ├── preload.ts
    │   ├── ipc/                   satu file per domain, tanpa logika bisnis
    │   │   ├── index.ts           mendaftarkan semua handler
    │   │   ├── settings.ipc.ts
    │   │   ├── accounts.ipc.ts
    │   │   ├── queue.ipc.ts
    │   │   ├── library.ipc.ts
    │   │   ├── analytics.ipc.ts
    │   │   ├── youtube.ipc.ts
    │   │   └── modes.ipc.ts       meneruskan ke mode terpilih lewat registry
    │   ├── platform/              layanan bersama yang stabil
    │   │   ├── db.ts              SQLite (sql.js)
    │   │   ├── secrets.ts         API key dan token terenkripsi (safeStorage)
    │   │   ├── spawn-process.ts   proses anak dengan pembatalan
    │   │   ├── ffmpeg.ts          penjalan ffmpeg
    │   │   ├── job-registry.ts    registry per job
    │   │   └── ai/                klien gemini, groq, deepgram, pexels, tts, penyedia gambar/video
    │   ├── youtube/               account.ts, upload.ts, schedule.ts, quota.ts, analytics.ts
    │   └── modes/                 tiap mode terisolasi, tidak saling impor
    │       ├── registry.ts        daftar mode (satu entri per mode)
    │       ├── alur-cerita/       pipeline.ts, script.ts, visual.ts, voice.ts, render.ts
    │       ├── fakta-unik/
    │       ├── animasi-3d/
    │       ├── kids/
    │       ├── asmr-konstruksi/
    │       └── bedah-konten/      analyze.ts, ideas.ts (tanpa render)
    └── renderer/                  UI (React + Tailwind)
        └── src/
            ├── main.tsx  App.tsx  index.css
            ├── ui/                komponen dasar reusable: Button, Card, Field, Notice, PageHeader,
            │                      ProgressBar, StatusChip, QuotaMeter, Modal
            ├── components/        gabungan reusable lintas view: ModePicker, StepIndicator,
            │                      AccountSwitcher, VideoCard, JobRow
            ├── layout/            Sidebar, TitleBar, tema
            ├── hooks/             pembungkus pemanggilan IPC (useIpc, useJobProgress)
            ├── modes/             form dan hasil khusus tiap mode, terisolasi
            │   ├── alur-cerita/
            │   ├── fakta-unik/
            │   └── ...
            └── views/
                ├── Create/        pilih mode lalu memuat form dari modes/
                ├── Queue/
                ├── Library/
                ├── Analytics/
                ├── Accounts/
                └── Settings/
```

Aturan:

- `shared/` tidak boleh mengimpor `electron` atau Node API.
- **IPC**: file di `main/ipc/` hanya memvalidasi input, memanggil modul yang sesuai, dan mengembalikan hasil. Logika bisnis tetap di luar. Nama channel dan tipenya hanya didefinisikan di `shared/ipc-channels.ts`.
- **Mode**: folder mode tidak boleh mengimpor folder mode lain. Boleh mengimpor `platform/`, `youtube/`, dan `shared/`. Interaksi dengan sisa aplikasi hanya lewat kontrak di `shared/contracts/`.
- **UI**: view hanya merakit komponen. Komponen di `ui/` tidak tahu soal IPC atau mode; komponen di `components/` boleh memakai `hooks/` tetapi tidak boleh bergantung pada satu mode tertentu.
- Proses berat (ffmpeg, whisper, Piper) dijalankan lewat `spawn-process` yang mendukung pembatalan.
- Setiap job punya registry sendiri, jadi membatalkan satu job tidak menghentikan job lain.
- API key tidak pernah dikirim ke renderer, hanya status "sudah diisi".
- Mode baru ditambahkan dengan satu folder di `main/modes/`, satu folder di `renderer/src/modes/`, dan satu entri di `registry.ts`.

Stack awal: Electron, electron-vite, React 18, TypeScript, Tailwind 3, lucide-react, sonner, sql.js. Versi: **terbaru**, kecuali dua pengecualian yang sengaja ditahan: **Tailwind 3.x** (Tailwind 4 mengganti konfigurasi ke CSS, sedangkan token brand kita memakai `tailwind.config.js`) dan **React 18.3** (belum butuh fitur 19). Pasang tanpa menyematkan versi, jalankan `npm run dev` dan `typecheck` sebelum menulis fitur; bila satu paket baru bermasalah, turunkan hanya paket itu. Sebagai pembanding, `clipper-cuan/desktop/package.json` memakai Electron 44, Vite 7, electron-vite 5, TypeScript 5.7.

---

## Lampiran: urutan setup awal

Dikerjakan pengguna sendiri, dipandu langkah demi langkah.

1. Buat folder `D:\project\youfarm`, lalu jalankan `npm init -y`.
2. Pasang dependensi versi terbaru (kecuali tailwindcss 3 dan react 18, lihat catatan stack): electron, electron-vite, react, react-dom, typescript, tailwindcss 3, postcss, autoprefixer, vite, `@vitejs/plugin-react`, lucide-react, sonner, sql.js.
3. Buat tiga file tsconfig (`tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`) dan `electron.vite.config.ts`.
4. Buat jendela Electron kosong (`main/index.ts`, `preload.ts`, `renderer/index.html`, `App.tsx`) dan pastikan `npm run dev` jalan.
5. Pasang token brand dari `docs/brand-mockup.html` ke Tailwind dan `index.css`, buat sidebar, lalu halaman kosong untuk Buat, Antrean, Library, Analitik, Akun, dan Settings.

Setelah langkah 5 selesai, lanjut ke Fase 1 (bagian 10).
