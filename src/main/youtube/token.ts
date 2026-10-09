import { googleErrorMessage } from '../../shared/youtube/oauth.ts'

/** tokenDead = Google memastikan refresh token tidak berlaku lagi (bukan sekadar gangguan jaringan). */
export class YoutubeTokenError extends Error {
  readonly tokenDead: boolean
  constructor(message: string, tokenDead: boolean) {
    super(message)
    this.tokenDead = tokenDead
  }
}

export const HTTP_TIMEOUT_MS = 20_000

export interface GoogleResponse {
  ok: boolean
  status: number
  body: Record<string, unknown>
}

export async function googleRequest(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<GoogleResponse> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: signal ?? AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  } catch {
    throw new Error('Tidak bisa terhubung ke Google. Periksa koneksi internet lalu coba lagi.')
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

export async function refreshAccessToken(p: {
  clientId: string
  clientSecret: string
  refreshToken: string
  tokenUrl: string
  signal?: AbortSignal
}): Promise<string> {
  const res = await googleRequest(
    p.tokenUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: p.clientId,
        client_secret: p.clientSecret,
        refresh_token: p.refreshToken,
        grant_type: 'refresh_token'
      })
    },
    p.signal
  )
  if (!res.ok) {
    const dead = res.body.error === 'invalid_grant'
    throw new YoutubeTokenError(
      dead ? 'Akses akun ini sudah dicabut atau kedaluwarsa. Hubungkan ulang akunnya.' : googleErrorMessage(res.body, res.status),
      dead
    )
  }
  const token = res.body.access_token
  if (typeof token !== 'string') throw new YoutubeTokenError('Google tidak mengirim access token.', false)
  return token
}
