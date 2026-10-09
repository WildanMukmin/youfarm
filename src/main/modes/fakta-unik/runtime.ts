import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSettings } from '../../platform/settings'
import { getFootageLibrary } from '../../platform/footage'
import { DEEPGRAM_VOICES, GEMINI_VOICES, languageInfo, voiceSourceSupports, type LanguageCode } from '@shared/languages'
import { getDeepgram, getElevenLabs, getGemini, getStock, getTextLlm } from '../../platform/ai/clients'
import { getFfmpeg, binDir } from '../../platform/binaries'
import { splitNarration } from '../../platform/voice/narration-split'
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
  const gemini = getGemini()
  const voices = piper()

  return {
    llm: ({ options, ...p }) => getTextLlm({ provider: options.textProvider, model: options.textModel })(p),
    stock: getStock,
    speak: async ({ text, out, options, signal }) => {
      if (options.voiceSource === 'gemini-tts') {
        if (!options.ttsModel) throw new Error('Pilih model Gemini untuk suara (TTS) di tab Suara.')
        const voice = GEMINI_VOICES.some((v) => v.id === options.voiceName) ? options.voiceName : 'Kore'
        await writeFile(out, await gemini.speak({ model: options.ttsModel, voice, text, signal }))
        return
      }
      if (options.voiceSource === 'deepgram') {
        const list = DEEPGRAM_VOICES[options.language as LanguageCode]
        if (!list?.length) throw new Error(`Deepgram belum punya suara ${languageInfo(options.language).label}. Pilih Gemini TTS.`)
        const model = list.find((v) => v.id === options.voiceName)?.id ?? list[0].id
        await writeFile(out, await getDeepgram().speak({ model, text, signal }))
        return
      }
      if (options.voiceSource === 'elevenlabs') {
        if (!voiceSourceSupports('elevenlabs', options.language)) throw new Error(`ElevenLabs belum mendukung ${languageInfo(options.language).label}. Pilih Gemini TTS.`)
        await writeFile(out, await getElevenLabs().speak({ voiceId: options.voiceName || undefined, text, signal }))
        return
      }
      const voice = pickVoice(voices.voices(), options.language, options.voiceName)
      if (!voice) throw new Error(`Suara Piper bahasa ${languageInfo(options.language).label} belum terpasang. Pilih Gemini TTS atau Deepgram.`)
      await voices.synth({ text, voice, out, signal })
    },
    // Jatah gratis Gemini TTS hanya beberapa permintaan per menit dan per hari, jadi satu video = satu permintaan.
    speakAll: async ({ texts, outs, options, signal }) => {
      if (options.voiceSource !== 'gemini-tts') return null
      if (!options.ttsModel) throw new Error('Pilih model Gemini untuk suara (TTS) di tab Suara.')
      const voice = GEMINI_VOICES.some((v) => v.id === options.voiceName) ? options.voiceName : 'Kore'
      const wav = await gemini.speak({ model: options.ttsModel, voice, text: texts.join(' '), signal })
      const { wavs, estimated } = splitNarration(wav, texts)
      await Promise.all(wavs.map((w, i) => writeFile(outs[i], w)))
      return { warnings: estimated > 0 ? ['Batas antar kalimat di suara diperkirakan dari panjang teks karena jedanya tidak jelas. Periksa sinkron caption dan footage.'] : [] }
    },
    ffmpeg: getFfmpeg(),
    fontsDir: join(app.getAppPath(), 'assets', 'fonts', 'caption'),
    cacheDir: join(app.getPath('userData'), 'cache', 'footage'),
    library: getFootageLibrary(),
    libraryMaxBytes: getSettings().footageCapGb * 1024 ** 3,
    // Hanya build pengembangan: tentukan peluang bertanya ke penyedia (0 = selalu pustaka dulu) untuk menguji alurnya.
    refreshRate: app.isPackaged || process.env.YOUFARM_FOOTAGE_REFRESH === undefined ? undefined : Number(process.env.YOUFARM_FOOTAGE_REFRESH),
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
