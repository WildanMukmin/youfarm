/** Kontrak IPC: nama channel dan tipe parameter/hasil. Satu-satunya tempat channel didefinisikan. */
import type { SecretKey, SecretStatus, Settings } from './settings'
import type { YoutubeAccountStatus, YoutubeDisconnectResult } from './youtube/accounts'
import type { QueueSnapshot } from './youtube/queue'
import type { RenderedVideo } from './contracts/modes'
import type { Privacy } from './youtube/metadata'

export const IPC = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  secretsStatus: 'secrets:status',
  secretsSet: 'secrets:set',
  secretsClear: 'secrets:clear',
  dialogSelectFolder: 'dialog:select-folder',
  aiGeminiModels: 'ai:gemini-models',
  ytStatus: 'youtube:status',
  ytSetCredentials: 'youtube:set-credentials',
  ytConnect: 'youtube:connect',
  ytCancelConnect: 'youtube:cancel-connect',
  ytCheck: 'youtube:check',
  ytDisconnect: 'youtube:disconnect',
  ytClearCredentials: 'youtube:clear-credentials',
  queueSnapshot: 'queue:snapshot',
  queueRetry: 'queue:retry',
  queueRemove: 'queue:remove',
  queueCancelCurrent: 'queue:cancel-current',
  modeRun: 'mode:run',
  modeCancel: 'mode:cancel',
  modeProgress: 'mode:progress',
  modeVoices: 'mode:voices',
  modeOpen: 'mode:open',
  modeEnqueue: 'mode:enqueue'
} as const

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export type { QueueSnapshot, SecretKey, SecretStatus, Settings, YoutubeAccountStatus, YoutubeDisconnectResult }

export type JobStage = 'script' | 'voice' | 'visual' | 'render' | 'thumbnail' | 'done'

export interface ModeProgress {
  jobId: string
  stage: JobStage
  percent: number
  message: string
}

export interface ModeRunResult {
  jobId: string
  video: RenderedVideo
  description: string
  tags: string[]
  /** Kalimat naskah, untuk ditampilkan di panel Naskah. */
  sentences: string[]
  warnings: string[]
}

export interface VoiceCatalog {
  piper: { name: string; lang: string }[]
  gemini: string[]
}

export interface EnqueueJobRequest {
  jobId: string
  channelId: string
  privacy: Privacy
  /** True: tayang terjadwal di slot kosong berikutnya. */
  schedule: boolean
}

export interface EnqueueJobResult {
  queueId: number
  publishAt: string | null
}
