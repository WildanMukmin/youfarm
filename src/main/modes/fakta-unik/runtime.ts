import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSettings } from '../../platform/settings'
import { DEEPGRAM_VOICES, GEMINI_VOICES, languageInfo, type LanguageCode } from '@shared/languages'
import { getDeepgram, getGemini, getStock, getTextLlm } from '../../platform/ai/clients'
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

/** Susun dependensi nyata (penulis teks, footage stock, suara, ffmpeg) dari pengaturan dan key pengguna. */
export function buildDeps(onProgress?: (p: Progress) => void): PipelineDeps {
  const settings = getSettings()
  const gemini = getGemini()
  const voices = piper()

  return {
    llm: getTextLlm(),
    stock: getStock,
    speak: async ({ text, out, options, signal }) => {
      if (options.voiceSource === 'gemini-tts') {
        if (!settings.geminiTtsModel) throw new Error('Pilih model Gemini untuk suara (TTS) di Settings > API.')
        const voice = GEMINI_VOICES.some((v) => v.id === options.voiceName) ? options.voiceName : 'Kore'
        await writeFile(out, await gemini.speak({ model: settings.geminiTtsModel, voice, text, signal }))
        return
      }
      if (options.voiceSource === 'deepgram') {
        const list = DEEPGRAM_VOICES[options.language as LanguageCode]
        if (!list?.length) throw new Error(`Deepgram belum punya suara ${languageInfo(options.language).label}. Pilih Gemini TTS.`)
        const model = list.find((v) => v.id === options.voiceName)?.id ?? list[0].id
        await writeFile(out, await getDeepgram().speak({ model, text, signal }))
        return
      }
      const voice = pickVoice(voices.voices(), options.language, options.voiceName)
      if (!voice) throw new Error(`Suara Piper bahasa ${languageInfo(options.language).label} belum terpasang. Pilih Gemini TTS atau Deepgram.`)
      await voices.synth({ text, voice, out, signal })
    },
    ffmpeg: getFfmpeg(),
    fontsDir: join(app.getAppPath(), 'assets', 'fonts', 'caption'),
    cacheDir: join(app.getPath('userData'), 'cache', 'footage'),
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
