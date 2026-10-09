/** Kontrak IPC: nama channel dan tipe parameter/hasil. Satu-satunya tempat channel didefinisikan. */
import type { SecretKey, SecretStatus, Settings } from './settings'
import type { YoutubeAccountStatus, YoutubeDisconnectResult } from './youtube/accounts'
import type { QueueSnapshot } from './youtube/queue'

export const IPC = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  secretsStatus: 'secrets:status',
  secretsSet: 'secrets:set',
  secretsClear: 'secrets:clear',
  dialogSelectFolder: 'dialog:select-folder',
  aiGeminiModels: 'ai:gemini-models',
  aiGroqModels: 'ai:groq-models',
  ytStatus: 'youtube:status',
  ytSetCredentials: 'youtube:set-credentials',
  ytConnect: 'youtube:connect',
  ytCancelConnect: 'youtube:cancel-connect',
  ytCheck: 'youtube:check',
  ytDisconnect: 'youtube:disconnect',
  ytClearCredentials: 'youtube:clear-credentials',
  ytSetSlots: 'youtube:set-slots',
  queueSnapshot: 'queue:snapshot',
  queueRetry: 'queue:retry',
  queueRemove: 'queue:remove',
  queueCancelCurrent: 'queue:cancel-current',
  queuePause: 'queue:pause',
  queueResume: 'queue:resume',
  queueOpenVideo: 'queue:open-video',
  prodSnapshot: 'production:snapshot',
  prodEnqueue: 'production:enqueue',
  prodCancel: 'production:cancel',
  prodRetry: 'production:retry',
  prodRemove: 'production:remove',
  prodPause: 'production:pause',
  prodResume: 'production:resume',
  prodOpen: 'production:open',
  prodDetail: 'production:detail',
  prodPublish: 'production:publish',
  modeVoices: 'mode:voices',
  modeSuggestTopics: 'mode:suggest-topics'
} as const

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export type { QueueSnapshot, SecretKey, SecretStatus, Settings, YoutubeAccountStatus, YoutubeDisconnectResult }

/** Suara yang tergantung instalasi lokal. Suara cloud (Gemini, Deepgram) ada di src/shared/languages.ts. */
export interface VoiceCatalog {
  piper: { name: string; lang: string }[]
}

export interface SuggestTopicsRequest {
  mode: string
  /** Niche yang sudah diketik pengguna; kosong = saran bebas. */
  seed: string
  language: string
}
