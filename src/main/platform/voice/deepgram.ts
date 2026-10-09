const BASE = 'https://api.deepgram.com/v1'
/** Batas teks per permintaan /speak. */
const MAX_CHARS = 2000

export type DeepgramErrorKind = 'key' | 'quota' | 'retry' | 'bad'

export class DeepgramError extends Error {
  readonly kind: DeepgramErrorKind
  constructor(kind: DeepgramErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface DeepgramTts {
  /** Teks jadi WAV mono 16-bit 24 kHz. `model` mis. "aura-2-thalia-en". */
  speak(p: { model: string; text: string; signal?: AbortSignal }): Promise<Buffer>
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function createDeepgramTts(opts: { apiKey: () => string | undefined; base?: string; retries?: number; retryDelayMs?: number }): DeepgramTts {
  const base = opts.base ?? BASE
  const retries = opts.retries ?? 2
  const delay = opts.retryDelayMs ?? 1500

  return {
    async speak({ model, text, signal }) {
      const key = opts.apiKey()
      if (!key) throw new DeepgramError('key', 'Key Deepgram belum diisi (Settings > API).')
      if (!/^aura-[\w-]+$/.test(model)) throw new DeepgramError('bad', 'Suara Deepgram tidak dikenal. Pilih suara lain.')
      const body = JSON.stringify({ text: text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS) })
      const url = `${base}/speak?${new URLSearchParams({ model, encoding: 'linear16', container: 'wav', sample_rate: '24000' })}`

      let last: DeepgramError | null = null
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await sleep(delay * 2 ** (attempt - 1))
        let res: Response
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
            body,
            signal: signal ?? AbortSignal.timeout(60_000)
          })
        } catch (e) {
          if (signal?.aborted) throw e
          last = new DeepgramError('retry', 'Tidak bisa terhubung ke Deepgram. Periksa koneksi internet.')
          continue
        }
        if (res.ok) {
          const wav = Buffer.from(await res.arrayBuffer())
          if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') throw new DeepgramError('bad', 'Deepgram tidak mengembalikan audio WAV.')
          return wav
        }
        const err = (await res.json().catch(() => ({}))) as { err_msg?: string; message?: string }
        if (res.status === 401 || res.status === 403) throw new DeepgramError('key', 'Key Deepgram ditolak. Periksa key di Settings > API.')
        if (res.status === 402) throw new DeepgramError('quota', 'Saldo Deepgram habis. Isi saldo di console.deepgram.com.')
        if (res.status === 429) {
          last = new DeepgramError('quota', 'Terlalu banyak permintaan ke Deepgram. Coba lagi sebentar lagi.')
          continue
        }
        if (res.status >= 500) {
          last = new DeepgramError('retry', 'Deepgram sedang bermasalah. Coba lagi sebentar lagi.')
          continue
        }
        throw new DeepgramError('bad', `Deepgram menolak permintaan: ${err.err_msg ?? err.message ?? `HTTP ${res.status}`}`)
      }
      throw last ?? new DeepgramError('retry', 'Deepgram tidak merespons.')
    }
  }
}
