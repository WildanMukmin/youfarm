import { pcmToWav } from '../ai/gemini-client.ts'

const BASE = 'https://api.elevenlabs.io/v1'
/** Flash v2.5: paling murah per karakter (setengah kredit) dan mendukung Indonesia serta 30-an bahasa lain. */
export const ELEVENLABS_MODEL = 'eleven_flash_v2_5'
/** Batas teks per permintaan. Satu kalimat naskah jauh di bawahnya. */
const MAX_CHARS = 5000
const RATE = 24000

export type ElevenLabsErrorKind = 'key' | 'quota' | 'retry' | 'bad'

export class ElevenLabsError extends Error {
  readonly kind: ElevenLabsErrorKind
  constructor(kind: ElevenLabsErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface ElevenLabsVoice {
  id: string
  label: string
}

export interface ElevenLabsTts {
  /** Suara yang bisa dipakai akun ini. */
  voices(): Promise<ElevenLabsVoice[]>
  /** Teks jadi WAV mono 16-bit 24 kHz. Tanpa `voiceId` dipakai suara pertama di akun. */
  speak(p: { voiceId?: string; text: string; signal?: AbortSignal }): Promise<Buffer>
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** ElevenLabs membungkus galat di `detail`: objek {status, message} atau teks biasa. */
function detailOf(body: unknown): { status: string; message: string } {
  const d = (body as { detail?: unknown })?.detail
  if (typeof d === 'string') return { status: '', message: d }
  const o = d as { status?: string; message?: string } | undefined
  return { status: o?.status ?? '', message: o?.message ?? '' }
}

function errorFor(status: number, body: unknown): ElevenLabsError {
  const { status: code, message } = detailOf(body)
  if (code === 'quota_exceeded') return new ElevenLabsError('quota', 'Kredit ElevenLabs bulan ini habis. Tunggu reset atau naikkan paket.')
  if (code === 'paid_plan_required' || status === 402) return new ElevenLabsError('bad', 'Suara atau fitur ini butuh paket ElevenLabs berbayar. Pilih suara lain atau naikkan paket.')
  if (code === 'detected_unusual_activity') return new ElevenLabsError('bad', 'ElevenLabs memblokir paket gratis karena aktivitas tak biasa. Pakai paket berbayar atau sumber suara lain.')
  if (status === 401 || status === 403) return new ElevenLabsError('key', 'Key ElevenLabs ditolak. Periksa key di Settings > API.')
  if (status === 429) return new ElevenLabsError('retry', 'Terlalu banyak permintaan ke ElevenLabs. Coba lagi sebentar lagi.')
  if (status >= 500) return new ElevenLabsError('retry', 'ElevenLabs sedang bermasalah. Coba lagi sebentar lagi.')
  return new ElevenLabsError('bad', `ElevenLabs menolak permintaan: ${message || `HTTP ${status}`}`)
}

export function createElevenLabsTts(opts: { apiKey: () => string | undefined; base?: string; retries?: number; retryDelayMs?: number }): ElevenLabsTts {
  const base = opts.base ?? BASE
  const retries = opts.retries ?? 2
  const delay = opts.retryDelayMs ?? 1500
  let firstVoice: string | null = null

  async function call(path: string, init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal }): Promise<Response> {
    const key = opts.apiKey()
    if (!key) throw new ElevenLabsError('key', 'Key ElevenLabs belum diisi (Settings > API).')
    let last: ElevenLabsError | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(delay * 2 ** (attempt - 1))
      let res: Response
      try {
        res = await fetch(`${base}${path}`, {
          method: init.method,
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: init.signal ?? AbortSignal.timeout(60_000)
        })
      } catch (e) {
        if (init.signal?.aborted) throw e
        last = new ElevenLabsError('retry', 'Tidak bisa terhubung ke ElevenLabs. Periksa koneksi internet.')
        continue
      }
      if (res.ok) return res
      last = errorFor(res.status, await res.json().catch(() => ({})))
      if (last.kind !== 'retry') throw last
    }
    throw last ?? new ElevenLabsError('retry', 'ElevenLabs tidak merespons.')
  }

  async function voices(): Promise<ElevenLabsVoice[]> {
    const json = (await (await call('/voices', { method: 'GET' })).json().catch(() => ({}))) as { voices?: { voice_id?: unknown; name?: unknown; category?: unknown }[] }
    const out: ElevenLabsVoice[] = []
    for (const v of json.voices ?? []) {
      if (typeof v.voice_id !== 'string' || !/^[\w-]{6,64}$/.test(v.voice_id) || typeof v.name !== 'string') continue
      out.push({ id: v.voice_id, label: typeof v.category === 'string' && v.category !== 'premade' ? `${v.name} · ${v.category}` : v.name })
    }
    return out
  }

  return {
    voices,

    async speak({ voiceId, text, signal }) {
      let id = voiceId
      if (!id) {
        firstVoice ??= (await voices())[0]?.id ?? null
        if (!firstVoice) throw new ElevenLabsError('bad', 'Akun ElevenLabs belum punya suara. Tambahkan suara di elevenlabs.io.')
        id = firstVoice
      }
      if (!/^[\w-]{6,64}$/.test(id)) throw new ElevenLabsError('bad', 'Suara ElevenLabs tidak dikenal. Pilih suara lain.')
      const res = await call(`/text-to-speech/${id}?${new URLSearchParams({ output_format: `pcm_${RATE}` })}`, {
        method: 'POST',
        signal,
        body: { text: text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS), model_id: ELEVENLABS_MODEL }
      })
      const pcm = Buffer.from(await res.arrayBuffer())
      if (pcm.length < 2) throw new ElevenLabsError('bad', 'ElevenLabs tidak mengembalikan audio.')
      return pcmToWav(pcm, RATE)
    }
  }
}
