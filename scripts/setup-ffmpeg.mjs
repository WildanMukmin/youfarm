// Mengunduh ffmpeg dan ffprobe ke binaries/win-x64.
// Versi dipin sengaja: jangan naikkan tanpa menguji render. Jalankan: npm run setup:ffmpeg [--force]
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, writeFile, rm, copyFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FFMPEG = '9.0.1'

if (process.platform !== 'win32') {
  console.error('Skrip ini baru mendukung Windows.')
  process.exit(1)
}

const outDir = join(ROOT, 'binaries', 'win-x64')
const force = process.argv.includes('--force')
const ffmpegExe = join(outDir, 'ffmpeg.exe')
const ffprobeExe = join(outDir, 'ffprobe.exe')

if (existsSync(ffmpegExe) && existsSync(ffprobeExe) && !force) {
  console.log('ffmpeg dan ffprobe sudah ada. Pakai --force untuk mengunduh ulang.')
  process.exit(0)
}

const name = `ffmpeg-${FFMPEG}-essentials_build`
const url = `https://github.com/GyanD/codexffmpeg/releases/download/${FFMPEG}/${name}.zip`
const work = join(tmpdir(), `youfarm-ffmpeg-${Date.now()}`)
await mkdir(work, { recursive: true })
const zip = join(work, `${name}.zip`)

try {
  console.log(`Mengunduh ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Unduhan gagal: HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(zip))

  console.log('Mengekstrak...')
  // tar bawaan Windows 10+ (bsdtar) bisa membaca zip. Dipanggil lewat path penuh karena
  // tar di PATH bisa saja GNU tar (mis. dari Git) yang tidak mengerti zip.
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  const x = spawnSync(tar, ['-xf', zip, '-C', work], { stdio: 'inherit' })
  if (x.status !== 0) throw new Error('Ekstrak gagal. Pastikan perintah tar tersedia.')

  await mkdir(outDir, { recursive: true })
  for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
    await copyFile(join(work, name, 'bin', exe), join(outDir, exe))
  }
  await writeFile(join(outDir, 'VERSIONS.json'), JSON.stringify({ ffmpeg: FFMPEG, downloadedAt: new Date().toISOString() }, null, 2))

  const v = spawnSync(ffmpegExe, ['-version'], { encoding: 'utf8' })
  if (v.status !== 0) throw new Error('ffmpeg terunduh tetapi tidak bisa dijalankan.')
  console.log(v.stdout.split('\n')[0])
} finally {
  await rm(work, { recursive: true, force: true })
}
