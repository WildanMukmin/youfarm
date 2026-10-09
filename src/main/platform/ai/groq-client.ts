import { parseJsonLoose } from './gemini-client.ts'

const BASE = 'https://api.groq.com/openai/v1'

export type GroqErrorKind = 'key' | 'quota' | 'retry' | 'bad'

export class GroqError extends Error {
  readonly kind: GroqErrorKind
  constructor(kind: GroqErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface GroqClient {
  /** Model teks (chat) yang aktif untuk key ini. */
  listModels(): Promise<string[]>
  /** Minta keluaran JSON. Prompt harus menyebut kata "JSON" (syarat mode JSON Groq). */
  completeJson(p: { model: string; system: string; user: string; temperature?: number; signal?: AbortSignal }): Promise<unknown>
}

export interface GroqClientOptions {
  apiKey: () => string | undefined
  base?: string
  retries?: number
  retryDelayMs?: number
}

/** Model non-teks (transkripsi, suara, penjaga keamanan) tidak cocok untuk menulis naskah. */
const NON_TEXT = /whisper|tts|guard|orpheus|playai|distil/i

export function parseGroqModels(json: unknown): string[] {
  const data = (json as { data?: { id?: unknown; active?: unknown }[] })?.data
  if (!Array.isArray(data)) return []
  return data
    .filter((m) => typeof m.id === 'string' && m.active !== false && !NON_TEXT.test(m.id))
    .map((m) => m.id as string)
    .sort()
}

function errorFor(status: number, body: unknown): GroqError {
  const msg = (body as { error?: { message?: string; code?: string } })?.error
  if (status === 401 || status === 403) return new GroqError('key', 'Key Groq ditolak. Periksa key di Settings > API.')
  if (status === 429) return new GroqError('quota', 'Batas permintaan Groq tercapai. Coba lagi sebentar lagi.')
  if (status >= 500) return new GroqError('retry', 'Groq sedang bermasalah. Coba lagi sebentar lagi.')
  if (status === 404 || msg?.code === 'model_not_found') return new GroqError('bad', 'Model Groq tidak ditemukan. Pilih model lain di Settings > API.')
  if (msg?.code === 'json_validate_failed') return new GroqError('retry', 'Groq gagal menyusun JSON.')
  return new GroqError('bad', `Groq menolak permintaan (HTTP ${status}).`)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function createGroqClient(opts: GroqClientOptions): GroqClient {
  const base = opts.base ?? BASE
  const retries = opts.retries ?? 2
  const delay = opts.retryDelayMs ?? 1500

  async function call(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<unknown> {
    const key = opts.apiKey()
    if (!key) throw new GroqError('key', 'Key Groq belum diisi (Settings > API).')
    let last: GroqError | null = null
    let wait = 0
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(wait || delay * 2 ** (attempt - 1))
      wait = 0
      let res: Response
      try {
        res = await fetch(`${base}${path}`, {
          method: init.method ?? 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: init.signal ?? AbortSignal.timeout(120_000)
        })
      } catch (e) {
        if (init.signal?.aborted) throw e
        last = new GroqError('retry', 'Tidak bisa terhubung ke Groq. Periksa koneksi internet.')
        continue
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok) return json
      last = errorFor(res.status, json)
      // Batas per menit Groq memberi tahu lama tunggunya; tunggu bila singkat, selain itu langsung gagal.
      if (last.kind === 'quota') {
        const after = Number(res.headers.get('retry-after'))
        if (!(Number.isFinite(after) && after > 0 && after <= 20)) throw last
        wait = after * 1000
        continue
      }
      if (last.kind !== 'retry') throw last
    }
    throw last ?? new GroqError('retry', 'Groq tidak merespons.')
  }

  return {
    async listModels() {
      return parseGroqModels(await call('/models', { method: 'GET' }))
    },

    async completeJson(p) {
      const json = (await call('/chat/completions', {
        signal: p.signal,
        body: {
          model: p.model,
          temperature: p.temperature ?? 0.9,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: p.system },
            { role: 'user', content: p.user }
          ]
        }
      })) as { choices?: { message?: { content?: string } }[] }
      const text = json.choices?.[0]?.message?.content ?? ''
      if (!text) throw new GroqError('bad', 'Groq tidak memberi jawaban.')
      try {
        return parseJsonLoose(text)
      } catch {
        throw new GroqError('bad', 'AI tidak mengembalikan JSON yang valid.')
      }
    }
  }
}
