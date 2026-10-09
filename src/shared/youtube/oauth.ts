/** Logika murni OAuth Google: URL login, membaca redirect, dan pesan error yang bisa dikerjakan pengguna. */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const CONNECT_CANCELLED_MESSAGE = 'Proses menghubungkan dibatalkan.'

export function buildAuthUrl(p: {
  clientId: string
  redirectUri: string
  scopes: string[]
  challenge: string
  state: string
  endpoint?: string
}): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: p.scopes.join(' '),
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    state: p.state,
    // Tanpa dua ini Google tidak mengirim refresh token pada login berikutnya.
    access_type: 'offline',
    prompt: 'consent'
  })
  return `${p.endpoint ?? GOOGLE_AUTH_URL}?${q.toString()}`
}

export type RedirectResult = { kind: 'code'; code: string } | { kind: 'denied'; error: string } | { kind: 'ignore' }

/**
 * Server loopback bisa menerima permintaan lain (favicon, proses lokal lain).
 * Yang state-nya tidak cocok diabaikan, bukan dianggap gagal, supaya
 * permintaan liar tidak bisa menggagalkan login yang sedang berjalan.
 */
export function parseRedirect(requestUrl: string, expectedState: string): RedirectResult {
  const params = new URL(requestUrl, 'http://127.0.0.1').searchParams
  if (params.get('state') !== expectedState) return { kind: 'ignore' }
  const error = params.get('error')
  if (error) return { kind: 'denied', error }
  const code = params.get('code')
  return code ? { kind: 'code', code } : { kind: 'ignore' }
}

interface GoogleErrorBody {
  error?: string | { message?: string; errors?: { reason?: string }[] }
  error_description?: string
}

/** Pesan Google teknis dan berbahasa Inggris; yang sering muncul saat setup diganti langkah yang bisa dikerjakan. */
export function googleErrorMessage(body: unknown, httpStatus: number): string {
  const b = (body ?? {}) as GoogleErrorBody
  const code = typeof b.error === 'string' ? b.error : undefined
  const reason = typeof b.error === 'object' ? b.error?.errors?.[0]?.reason : undefined

  if (code === 'invalid_client') return 'Google menolak Client ID atau Client Secret. Periksa lagi isiannya.'
  if (code === 'invalid_grant') return 'Kode izin sudah tidak berlaku. Coba hubungkan lagi.'
  if (code === 'redirect_uri_mismatch') return 'Jenis OAuth client harus Desktop app.'
  if (reason === 'accessNotConfigured') return 'YouTube Data API v3 belum diaktifkan di project Google Cloud Anda.'
  if (reason === 'youtubeSignupRequired') return 'Akun Google ini belum punya kanal YouTube.'

  const detail = b.error_description ?? (typeof b.error === 'object' ? b.error?.message : undefined) ?? code
  return detail ? `Google menolak permintaan (${detail}).` : `Google menolak permintaan (HTTP ${httpStatus}).`
}

export function deniedMessage(error: string): string {
  if (error === 'access_denied') return 'Izin ditolak di halaman Google, jadi akun tidak dihubungkan.'
  return `Google menghentikan login (${error}).`
}
