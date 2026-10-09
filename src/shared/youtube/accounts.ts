/** Tipe dan logika murni untuk akun YouTube. Token dan secret sudah terenkripsi saat sampai di sini. */
import { normalizeSlots } from './schedule.ts'

export const SCOPE_READONLY = 'https://www.googleapis.com/auth/youtube.readonly'
export const SCOPE_UPLOAD = 'https://www.googleapis.com/auth/youtube.upload'
export const SCOPE_ANALYTICS = 'https://www.googleapis.com/auth/yt-analytics.readonly'

/** Izin yang diminta saat menghubungkan: baca nama kanal, upload, dan analitik. */
export const YOUTUBE_SCOPES = [SCOPE_READONLY, SCOPE_UPLOAD, SCOPE_ANALYTICS]

/** Token app Google Cloud yang masih mode Testing kedaluwarsa 7 hari setelah diterbitkan. */
export const TESTING_TOKEN_DAYS = 7

/** Jam tayang (waktu lokal) untuk channel yang belum diatur. */
export const DEFAULT_SLOTS = ['07:00', '12:00', '19:00']
export const MAX_SLOTS = 12

export interface YoutubeChannel {
  id: string
  title: string
}

export interface StoredAccount {
  channel: YoutubeChannel
  /** Terenkripsi. */
  refreshToken: string
  connectedAt: string
  scopes: string[]
  lastCheckedAt?: string
  lastCheckOk?: boolean
  /** Jam tayang "HH:MM" waktu lokal. Kosong/undefined = DEFAULT_SLOTS. */
  slots?: string[]
}

export interface StoredYoutube {
  clientId?: string
  /** Terenkripsi. */
  clientSecret?: string
  accounts?: Record<string, StoredAccount>
}

/**
 * - ok: token sehat dan semua izin ada
 * - unchecked: belum pernah diperiksa
 * - reconnect: token mati atau izin upload hilang, harus dihubungkan ulang
 * - needs-analytics: bisa upload, tetapi belum memberi izin analitik
 */
export type AccountState = 'ok' | 'unchecked' | 'reconnect' | 'needs-analytics'

export interface YoutubeAccountInfo {
  channel: YoutubeChannel
  connectedAt: string
  lastCheckedAt: string | null
  state: AccountState
  canUpload: boolean
  canAnalytics: boolean
  /** Perkiraan kedaluwarsa bila app Google Cloud masih mode Testing. */
  testingExpiryAt: string
  /** Jam tayang efektif (sudah memakai bawaan bila belum diatur). */
  slots: string[]
}

export interface YoutubeAccountStatus {
  clientId: string | null
  hasCredentials: boolean
  accounts: YoutubeAccountInfo[]
}

export interface YoutubeDisconnectResult {
  status: YoutubeAccountStatus
  /** False bila pencabutan di sisi Google gagal (mis. offline); akun tetap dilepas dari aplikasi. */
  revoked: boolean
}

export const hasScope = (scopes: string[], scope: string): boolean => scopes.includes(scope)

export function accountState(a: Pick<StoredAccount, 'scopes' | 'lastCheckOk'>): AccountState {
  if (a.lastCheckOk === false || !hasScope(a.scopes, SCOPE_UPLOAD)) return 'reconnect'
  if (!hasScope(a.scopes, SCOPE_ANALYTICS)) return 'needs-analytics'
  if (a.lastCheckOk === undefined) return 'unchecked'
  return 'ok'
}

export function testingExpiry(connectedAt: string): string {
  const t = new Date(connectedAt).getTime()
  return new Date(t + TESTING_TOKEN_DAYS * 86_400_000).toISOString()
}

export function accountInfos(store: StoredYoutube): YoutubeAccountInfo[] {
  return Object.values(store.accounts ?? {})
    .map((a) => ({
      channel: a.channel,
      connectedAt: a.connectedAt,
      lastCheckedAt: a.lastCheckedAt ?? null,
      state: accountState(a),
      canUpload: hasScope(a.scopes, SCOPE_UPLOAD),
      canAnalytics: hasScope(a.scopes, SCOPE_ANALYTICS),
      testingExpiryAt: testingExpiry(a.connectedAt),
      slots: a.slots ?? DEFAULT_SLOTS
    }))
    .sort((x, y) => x.channel.title.localeCompare(y.channel.title, 'id'))
}

export function upsertAccount(store: StoredYoutube, account: StoredAccount): StoredYoutube {
  return { ...store, accounts: { ...(store.accounts ?? {}), [account.channel.id]: account } }
}

export function markChecked(store: StoredYoutube, channelId: string, checkedAt: string, ok: boolean): StoredYoutube {
  const account = store.accounts?.[channelId]
  return account ? upsertAccount(store, { ...account, lastCheckedAt: checkedAt, lastCheckOk: ok }) : store
}

/** Simpan jam tayang channel. Format tak valid dan duplikat dibuang; minimal satu, maksimal MAX_SLOTS. */
export function setAccountSlots(store: StoredYoutube, channelId: string, times: unknown): StoredYoutube {
  const account = store.accounts?.[channelId]
  if (!account) throw new Error('Kanal ini sudah tidak ada di daftar.')
  const list = normalizeSlots(Array.isArray(times) ? times.filter((t): t is string => typeof t === 'string') : [])
  if (list.length === 0) throw new Error('Isi minimal satu jam tayang (format JJ:MM).')
  if (list.length > MAX_SLOTS) throw new Error(`Maksimal ${MAX_SLOTS} jam tayang per channel.`)
  return upsertAccount(store, { ...account, slots: list })
}

export function removeAccount(store: StoredYoutube, channelId: string): StoredYoutube {
  const { [channelId]: _removed, ...rest } = store.accounts ?? {}
  return { ...store, accounts: rest }
}

export function validateClientId(id: string): string | null {
  return id.trim().endsWith('.apps.googleusercontent.com')
    ? null
    : 'Client ID harus berakhiran .apps.googleusercontent.com. Salin dari Google Cloud Console.'
}

export function isChannelId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)
}
