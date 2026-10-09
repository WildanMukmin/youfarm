import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnProcess } from '../spawn-process.ts'

export interface PiperVoice {
  /** Nama berkas tanpa ekstensi, mis. "id_ID-news_tts-medium". */
  name: string
  modelPath: string
  /** Kode bahasa dari nama berkas: "id" atau "en". */
  lang: string
}

/** Suara Piper yang terpasang: berkas .onnx yang punya pasangan .onnx.json. */
export function listPiperVoices(modelsDir: string): PiperVoice[] {
  if (!existsSync(modelsDir)) return []
  return readdirSync(modelsDir)
    .filter((f) => f.endsWith('.onnx') && existsSync(join(modelsDir, `${f}.json`)))
    .map((f) => {
      const name = f.slice(0, -'.onnx'.length)
      return { name, modelPath: join(modelsDir, f), lang: name.split(/[-_]/)[0].toLowerCase() }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Suara yang diminta bila ada; bila tidak, suara pertama untuk bahasa itu. */
export function pickVoice(voices: PiperVoice[], lang: string, preferred?: string): PiperVoice | null {
  return voices.find((v) => v.name === preferred && v.lang === lang) ?? voices.find((v) => v.lang === lang) ?? null
}

export interface Piper {
  voices(): PiperVoice[]
  /** Ucapkan `text` ke berkas WAV. `lengthScale` > 1 memperlambat, < 1 mempercepat. */
  synth(p: { text: string; voice: PiperVoice; out: string; lengthScale?: number; signal?: AbortSignal }): Promise<void>
}

export function createPiper(opts: { piperDir: string; modelsDir: string }): Piper {
  const exe = join(opts.piperDir, 'piper.exe')
  return {
    voices: () => listPiperVoices(opts.modelsDir),
    async synth(p) {
      if (!existsSync(exe)) throw new Error('Piper belum terpasang. Jalankan "npm run setup:piper".')
      const args = ['--model', p.voice.modelPath, '--output_file', p.out]
      if (p.lengthScale) args.push('--length_scale', String(p.lengthScale))
      // Teks lewat stdin (UTF-8) supaya karakter khusus aman; satu baris = satu ucapan.
      const r = await spawnProcess(exe, args, { cwd: opts.piperDir, signal: p.signal, input: `${p.text.replace(/\s+/g, ' ').trim()}\n` })
      if (r.code !== 0) throw new Error(`Piper gagal (kode ${r.code}): ${r.stderrTail.split('\n').slice(-3).join(' ').trim()}`)
      if (!existsSync(p.out)) throw new Error('Piper tidak menghasilkan berkas suara.')
    }
  }
}
