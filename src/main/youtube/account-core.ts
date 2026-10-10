import { createHash, randomBytes } from 'node:crypto'
import type { Codec } from '../platform/secret-store.ts'
import {
  SCOPE_EMAIL,
  YOUTUBE_SCOPES,
  accountInfos,
  markChecked,
  removeAccount,
  setAccountSlots,
  upsertAccount,
  validateClientId,
  type StoredAccount,
  type StoredYoutube,
  type YoutubeAccountStatus,
  type YoutubeChannel,
  type YoutubeDisconnectResult
} from '../../shared/youtube/accounts.ts'
import { GOOGLE_AUTH_URL, buildAuthUrl, googleErrorMessage } from '../../shared/youtube/oauth.ts'
import { startAuthCodeListener } from './loopback.ts'
import { YoutubeTokenError, googleRequest, refreshAccessToken } from './token.ts'

export interface Endpoints {
  auth: string
  token: string
  revoke: string
  api: string
}

export const GOOGLE_ENDPOINTS: Endpoints = {
  auth: GOOGLE_AUTH_URL,
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  api: 'https://www.googleapis.com'
}

export interface AccountDeps {
  store: { read(): StoredYoutube; write(store: StoredYoutube): void }
  codec: Codec
  /** Membuka halaman login di browser. */
  openUrl: (url: string) => void | Promise<void>
  endpoints?: Endpoints
  now?: () => Date
  connectTimeoutMs?: number
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const createState = (): string => randomBytes(24).toString('base64url')

/** Inti layanan akun YouTube. Tidak mengimpor Electron, jadi bisa dites dengan server Google palsu. */
export function createAccountService(deps: AccountDeps) {
  const ep = deps.endpoints ?? GOOGLE_ENDPOINTS
  const now = deps.now ?? (() => new Date())
  let cancelPending: (() => void) | null = null

  const status = (): YoutubeAccountStatus => {
    const s = deps.store.read()
    return { clientId: s.clientId ?? null, hasCredentials: Boolean(s.clientId && s.clientSecret), accounts: accountInfos(s) }
  }

  const credentials = (s: StoredYoutube): { clientId: string; clientSecret: string } => {
    if (!s.clientId || !s.clientSecret) throw new Error('Isi Client ID dan Client Secret dulu.')
    return { clientId: s.clientId, clientSecret: deps.codec.decrypt(s.clientSecret) }
  }

  async function fetchChannel(accessToken: string): Promise<YoutubeChannel> {
    const res = await googleRequest(`${ep.api}/youtube/v3/channels?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) throw new Error(googleErrorMessage(res.body, res.status))
    const item = (res.body.items as { id?: string; snippet?: { title?: string } }[] | undefined)?.[0]
    if (!item?.id) throw new Error('Akun Google ini belum punya kanal YouTube.')
    return { id: item.id, title: item.snippet?.title ?? item.id }
  }

  /** Email akun Google. Hanya tambahan tampilan, jadi kegagalan di sini tidak boleh menggagalkan penghubungan. */
  async function fetchEmail(accessToken: string): Promise<string | undefined> {
    try {
      const res = await googleRequest(`${ep.api}/oauth2/v3/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const email = res.ok ? res.body.email : undefined
      return typeof email === 'string' && email.includes('@') ? email : undefined
    } catch {
      return undefined
    }
  }

  async function revoke(refreshTokenBlob: string): Promise<boolean> {
    try {
      const res = await googleRequest(ep.revoke, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: deps.codec.decrypt(refreshTokenBlob) })
      })
      return res.ok
    } catch {
      return false
    }
  }

  return {
    status,

    setCredentials(clientId: string, clientSecret: string): YoutubeAccountStatus {
      const id = clientId.trim()
      const secret = clientSecret.trim()
      const invalid = validateClientId(id)
      if (invalid) throw new Error(invalid)
      if (!secret) throw new Error('Client Secret kosong.')
      // Refresh token terikat ke client yang menerbitkannya: ganti client berarti semua akun dihubungkan ulang.
      const prev = deps.store.read()
      const same = prev.clientId === id
      deps.store.write({ ...(same ? prev : {}), clientId: id, clientSecret: deps.codec.encrypt(secret) })
      return status()
    },

    /** Menghubungkan kanal yang sudah ada menimpa token dan izinnya; kanal baru ditambahkan. */
    async connect(): Promise<YoutubeAccountStatus> {
      if (cancelPending) throw new Error('Proses menghubungkan masih berjalan. Selesaikan atau batalkan dulu.')
      const { clientId, clientSecret } = credentials(deps.store.read())

      const { verifier, challenge } = createPkcePair()
      const state = createState()
      const listener = startAuthCodeListener(
        state,
        (redirectUri) =>
          deps.openUrl(buildAuthUrl({ clientId, redirectUri, scopes: YOUTUBE_SCOPES, challenge, state, endpoint: ep.auth })),
        deps.connectTimeoutMs
      )
      cancelPending = listener.cancel
      let code: string
      let redirectUri: string
      try {
        ;({ code, redirectUri } = await listener.result)
      } finally {
        cancelPending = null
      }

      const token = await googleRequest(ep.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      })
      if (!token.ok) throw new Error(googleErrorMessage(token.body, token.status))
      const refreshToken = token.body.refresh_token
      if (typeof refreshToken !== 'string') {
        throw new Error(
          'Google tidak mengirim refresh token. Cabut akses aplikasi ini di myaccount.google.com/permissions, lalu coba lagi.'
        )
      }

      const accessToken = token.body.access_token as string
      const channel = await fetchChannel(accessToken)
      const granted = typeof token.body.scope === 'string' ? token.body.scope.split(' ') : YOUTUBE_SCOPES
      const email = granted.includes(SCOPE_EMAIL) ? await fetchEmail(accessToken) : undefined
      const at = now().toISOString()
      const account: StoredAccount = {
        channel,
        ...(email ? { email } : {}),
        refreshToken: deps.codec.encrypt(refreshToken),
        connectedAt: at,
        // Izin yang benar-benar diberikan; pengguna bisa mencentang sebagian di halaman Google.
        scopes: typeof token.body.scope === 'string' ? token.body.scope.split(' ') : YOUTUBE_SCOPES,
        // Token baru saja diterbitkan untuk kode yang sah, jadi dicatat terverifikasi.
        lastCheckedAt: at,
        lastCheckOk: true
      }
      deps.store.write(upsertAccount(deps.store.read(), account))
      return status()
    },

    cancelConnect(): void {
      cancelPending?.()
    },

    /**
     * Satu-satunya cara tahu refresh token masih hidup adalah memakainya. Gangguan jaringan
     * sengaja tidak dicatat sebagai token mati, supaya pengguna tidak disuruh login ulang
     * padahal tokennya baik-baik saja.
     */
    async check(channelId: string): Promise<YoutubeAccountStatus> {
      const s = deps.store.read()
      const account = s.accounts?.[channelId]
      if (!account) throw new Error('Kanal ini sudah tidak ada di daftar.')
      const { clientId, clientSecret } = credentials(s)
      try {
        await refreshAccessToken({
          clientId,
          clientSecret,
          refreshToken: deps.codec.decrypt(account.refreshToken),
          tokenUrl: ep.token
        })
      } catch (err) {
        if (!(err instanceof YoutubeTokenError) || !err.tokenDead) throw err
        deps.store.write(markChecked(deps.store.read(), channelId, now().toISOString(), false))
        return status()
      }
      deps.store.write(markChecked(deps.store.read(), channelId, now().toISOString(), true))
      return status()
    },

    /** Akun tetap dilepas dari aplikasi walau pencabutan di Google gagal; hasilnya dilaporkan. */
    async disconnect(channelId: string): Promise<YoutubeDisconnectResult> {
      const account = deps.store.read().accounts?.[channelId]
      const revoked = account ? await revoke(account.refreshToken) : true
      deps.store.write(removeAccount(deps.store.read(), channelId))
      return { status: status(), revoked }
    },

    /** Jam tayang per channel; dipakai saat video dijadwalkan ke slot kosong berikutnya. */
    setSlots(channelId: string, times: unknown): YoutubeAccountStatus {
      deps.store.write(setAccountSlots(deps.store.read(), channelId, times))
      return status()
    },

    async clearCredentials(): Promise<YoutubeDisconnectResult> {
      const accounts = Object.values(deps.store.read().accounts ?? {})
      const results = await Promise.all(accounts.map((a) => revoke(a.refreshToken)))
      deps.store.write({})
      return { status: status(), revoked: results.every(Boolean) }
    },

    /** Access token baru untuk satu kanal. Dipakai modul upload dan analitik. */
    async accessToken(channelId: string, signal?: AbortSignal): Promise<string> {
      const s = deps.store.read()
      const account = s.accounts?.[channelId]
      if (!account) throw new Error('Akun YouTube ini sudah tidak terhubung. Hubungkan lagi di menu Akun.')
      const { clientId, clientSecret } = credentials(s)
      return refreshAccessToken({
        clientId,
        clientSecret,
        refreshToken: deps.codec.decrypt(account.refreshToken),
        tokenUrl: ep.token,
        signal
      })
    }
  }
}

export type AccountService = ReturnType<typeof createAccountService>
