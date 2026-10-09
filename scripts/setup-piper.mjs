// Mengunduh Piper (TTS lokal) dan suara bawaan.
// Piper standalone ke binaries/win-x64/piper, suara ke models/piper. Jalankan: npm run setup:piper [--force]
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rm, cp } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PIPER = '2023.11.14-2'
const VOICES_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main'
// Suara dipin ke path model; tambah di sini bila perlu suara lain.
const VOICES = [
  { file: 'id_ID-news_tts-medium', path: 'id/id_ID/news_tts/medium' },
  { file: 'en_US-lessac-medium', path: 'en/en_US/lessac/medium' }
]

if (process.platform !== 'win32') {
  console.error('Skrip ini baru mendukung Windows.')
  process.exit(1)
}

const force = process.argv.includes('--force')
const binDir = join(ROOT, 'binaries', 'win-x64')
const piperDir = join(binDir, 'piper')
const modelsDir = join(ROOT, 'models', 'piper')

async function download(url, dest) {
  console.log(`Mengunduh ${url}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Unduhan gagal (HTTP ${res.status}): ${url}`)
  await pipeline(res.body, createWriteStream(dest))
}

await mkdir(modelsDir, { recursive: true })
const work = join(tmpdir(), `youfarm-piper-${Date.now()}`)
await mkdir(work, { recursive: true })

try {
  if (!existsSync(join(piperDir, 'piper.exe')) || force) {
    const zip = join(work, 'piper.zip')
    await download(`https://github.com/rhasspy/piper/releases/download/${PIPER}/piper_windows_amd64.zip`, zip)
    // tar bawaan Windows (bsdtar) via path penuh; tar di PATH bisa GNU tar yang tidak mengerti zip.
    const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    const x = spawnSync(tar, ['-xf', zip, '-C', work], { stdio: 'inherit' })
    if (x.status !== 0) throw new Error('Ekstrak Piper gagal.')
    await mkdir(binDir, { recursive: true })
    await rm(piperDir, { recursive: true, force: true })
    await cp(join(work, 'piper'), piperDir, { recursive: true })
  } else {
    console.log('Piper sudah ada, dilewati (pakai --force untuk mengunduh ulang).')
  }

  for (const v of VOICES) {
    const onnx = join(modelsDir, `${v.file}.onnx`)
    if (existsSync(onnx) && !force) {
      console.log(`Suara ${v.file} sudah ada, dilewati.`)
      continue
    }
    await download(`${VOICES_BASE}/${v.path}/${v.file}.onnx`, onnx)
    await download(`${VOICES_BASE}/${v.path}/${v.file}.onnx.json`, `${onnx}.json`)
  }

  const probe = spawnSync(join(piperDir, 'piper.exe'), ['--help'], { encoding: 'utf8' })
  if (probe.error) throw new Error(`piper.exe tidak bisa dijalankan: ${probe.error.message}`)
  console.log('Piper siap.')
} finally {
  await rm(work, { recursive: true, force: true })
}
