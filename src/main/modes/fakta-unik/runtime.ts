import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSettings } from '../../platform/settings'
import { getGemini, getPexels } from '../../platform/ai/clients'
import { getFfmpeg, binDir } from '../../platform/binaries'
import { createPiper, pickVoice } from '../../platform/voice/piper'
import { runFaktaUnik, type PipelineDeps, type PipelineResult, type Progress } from './pipeline'

const FALLBACK_BITRATE = 8000

/** Folder hasil: pengaturan pengguna, atau Videos\YouFarm. */
export function outputDir(): string {
  return getSettings().outputDir ?? join(app.getPath('videos'), 'YouFarm')
}

export function piper() {
  return createPiper({ piperDir: join(binDir(), 'piper'), modelsDir: join(app.getAppPath(), 'models', 'piper') })
}

/** Susun dependensi nyata (Gemini, Pexels, Piper, ffmpeg) dari pengaturan dan key pengguna. */
export function buildDeps(onProgress?: (p: Progress) => void): PipelineDeps {
  const settings = getSettings()
  const gemini = getGemini()
  const voices = piper()

  return {
    llm: async ({ system, user, signal }) => {
      if (settings.textProvider !== 'gemini') throw new Error('Mode ini baru mendukung Gemini untuk naskah. Pilih Gemini di Settings > API.')
      if (!settings.geminiTextModel) throw new Error('Pilih model Gemini untuk teks di Settings > API.')
      return gemini.completeJson({ model: settings.geminiTextModel, system, user, signal })
    },
    stock: getPexels(),
    speak: async ({ text, out, options, signal }) => {
      if (options.voiceSource === 'gemini-tts') {
        if (!settings.geminiTtsModel) throw new Error('Pilih model Gemini untuk suara (TTS) di Settings > API.')
        const wav = await gemini.speak({ model: settings.geminiTtsModel, voice: options.voiceName || 'Kore', text, signal })
        await writeFile(out, wav)
        return
      }
      const voice = pickVoice(voices.voices(), options.language, options.voiceName)
      if (!voice) throw new Error('Suara Piper untuk bahasa ini belum terpasang. Jalankan "npm run setup:piper".')
      await voices.synth({ text, voice, out, signal })
    },
    ffmpeg: getFfmpeg(),
    fontFile: join(app.getAppPath(), 'assets', 'fonts', 'caption', 'Poppins-Bold.ttf'),
    cacheDir: join(app.getPath('userData'), 'cache', 'pexels'),
    workDir: join(app.getPath('userData'), 'work'),
    outDir: outputDir(),
    bitrateKbps: FALLBACK_BITRATE,
    onProgress
  }
}

export async function runWithRealDeps(options: unknown, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<PipelineResult> {
  const deps = buildDeps(onProgress)
  await mkdir(deps.outDir, { recursive: true })
  return runFaktaUnik(options, deps, signal)
}
