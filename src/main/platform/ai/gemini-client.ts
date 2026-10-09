import { parseGeminiModels } from './gemini-models.ts'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GeminiErrorKind = 'key' | 'quota' | 'retry' | 'blocked' | 'bad'

export class GeminiError extends Error {
  readonly kind: GeminiErrorKind
  constructor(kind: GeminiErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface GeminiClient {
  listModels(): Promise<string[]>
  /** Minta keluaran JSON. Mengembalikan objek yang sudah di-parse. */
  completeJson(p: { model: string; system: string; user: string; temperature?: number; signal?: AbortSignal }): Promise<unknown>
  /** Teks jadi suara. Mengembalikan WAV mono 16-bit. */
  speak(p: { model: string; voice: string; text: string; signal?: AbortSignal }): Promise<Buffer>
}

export interface GeminiClientOptions {
  /** Dipanggil tiap permintaan supaya key yang diganti di Settings langsung dipakai. */
  apiKey: () => string | undefined
  base?: string
  /** Jumlah percobaan ulang untuk 429/5xx. */
  retries?: number
  retryDelayMs?: number
}

/** PCM 16-bit mono jadi berkas WAV. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(1, 22) // mono
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

/** Buang pagar kode markdown yang kadang membungkus JSON, lalu parse. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1))
    throw new GeminiError('bad', 'AI tidak mengembalikan JSON yang valid.')
  }
}

function errorFor(status: number, body: unknown): GeminiError {
  const msg = (body as { error?: { message?: string; status?: string } })?.error?.message ?? ''
  if (status === 400 && /api key/i.test(msg)) return new GeminiError('key', 'Key Gemini ditolak. Periksa key di Settings > API.')
  if (status === 401 || status === 403) return new GeminiError('key', 'Key Gemini ditolak atau tidak punya akses ke model ini.')
  if (status === 429) return new GeminiError('quota', 'Kuota Gemini habis atau terlalu banyak permintaan. Coba lagi nanti.')
  if (status >= 500) return new GeminiError('retry', 'Gemini sedang bermasalah. Coba lagi sebentar lagi.')
  if (status === 404) return new GeminiError('bad', 'Model Gemini tidak ditemukan. Pilih model lain di Settings > API.')
  return new GeminiError('bad', `Gemini menolak permintaan (HTTP ${status}).`)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function createGeminiClient(opts: GeminiClientOptions): GeminiClient {
  const base = opts.base ?? BASE
  const retries = opts.retries ?? 2
  const delay = opts.retryDelayMs ?? 1500

  async function call(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<unknown> {
    const key = opts.apiKey()
    if (!key) throw new GeminiError('key', 'Key Gemini belum diisi (Settings > API).')
    let last: GeminiError | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(delay * 2 ** (attempt - 1))
      let res: Response
      try {
        res = await fetch(`${base}${path}`, {
          method: init.method ?? 'POST',
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: init.signal ?? AbortSignal.timeout(120_000)
        })
      } catch (e) {
        if (init.signal?.aborted) throw e
        last = new GeminiError('retry', 'Tidak bisa terhubung ke Gemini. Periksa koneksi internet.')
        continue
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok) return json
      last = errorFor(res.status, json)
      if (last.kind !== 'retry') throw last
    }
    throw last ?? new GeminiError('retry', 'Gemini tidak merespons.')
  }

  const textOf = (json: unknown): string => {
    const r = json as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] }
    if (r.promptFeedback?.blockReason) throw new GeminiError('blocked', 'Permintaan diblokir oleh filter keamanan Gemini. Ubah topiknya.')
    const c = r.candidates?.[0]
    const text = c?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) {
      if (c?.finishReason === 'SAFETY') throw new GeminiError('blocked', 'Jawaban diblokir oleh filter keamanan Gemini. Ubah topiknya.')
      throw new GeminiError('bad', 'Gemini tidak memberi jawaban.')
    }
    return text
  }

  return {
    async listModels() {
      const json = await call('/models?pageSize=200', { method: 'GET' })
      return parseGeminiModels(json)
    },

    async completeJson(p) {
      const json = await call(`/models/${encodeURIComponent(p.model)}:generateContent`, {
        signal: p.signal,
        body: {
          systemInstruction: { parts: [{ text: p.system }] },
          contents: [{ role: 'user', parts: [{ text: p.user }] }],
          generationConfig: { temperature: p.temperature ?? 0.9, responseMimeType: 'application/json' }
        }
      })
      return parseJsonLoose(textOf(json))
    },

    async speak(p) {
      const json = (await call(`/models/${encodeURIComponent(p.model)}:generateContent`, {
        signal: p.signal,
        body: {
          contents: [{ parts: [{ text: p.text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voice } } }
          }
        }
      })) as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] }
      const inline = json.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData
      if (!inline?.data) throw new GeminiError('bad', 'Gemini tidak mengembalikan audio. Pastikan model yang dipilih mendukung suara (TTS).')
      const rate = Number(inline.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000)
      return pcmToWav(Buffer.from(inline.data, 'base64'), rate)
    }
  }
}
