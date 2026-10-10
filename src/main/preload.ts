import { contextBridge, ipcRenderer } from 'electron'
import type { EnqueueRequest } from '@shared/youtube/queue'
import type { ProductionDetail, ProductionEnqueueRequest, ProductionPublishRequest, ProductionPublishResult, ProductionSnapshot } from '@shared/production'
import type { ApiKeysOverview } from '@shared/api-keys'
import type { FootageInfo } from '@shared/footage'
import type { VoiceOption } from '@shared/languages'
import type { TopicSuggestion } from '@shared/modes/fakta-unik'
import {
  IPC,
  type AppInfo,
  type SuggestTopicsRequest,
  type VoiceCatalog,
  type QueueSnapshot,
  type SecretKey,
  type SecretStatus,
  type Settings,
  type YoutubeAccountStatus,
  type YoutubeDisconnectResult
} from '@shared/ipc-channels'

const api = {
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  dialog: {
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.dialogSelectFolder)
  },
  ai: {
    geminiModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.aiGeminiModels),
    groqModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.aiGroqModels),
    elevenlabsVoices: (): Promise<VoiceOption[]> => ipcRenderer.invoke(IPC.aiElevenLabsVoices)
  },
  secrets: {
    status: (): Promise<SecretStatus> => ipcRenderer.invoke(IPC.secretsStatus)
  },
  footage: {
    stats: (): Promise<FootageInfo> => ipcRenderer.invoke(IPC.footageStats),
    clear: (): Promise<FootageInfo> => ipcRenderer.invoke(IPC.footageClear)
  },
  keys: {
    overview: (): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysOverview),
    add: (provider: SecretKey, label: string, value: string): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysAdd, provider, label, value),
    remove: (provider: SecretKey, id: string): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysRemove, provider, id),
    select: (provider: SecretKey, id: string): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysSelect, provider, id),
    rename: (provider: SecretKey, id: string, label: string): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysRename, provider, id, label),
    setAuto: (provider: SecretKey, auto: boolean): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysSetAuto, provider, auto),
    resetLimit: (provider: SecretKey, id: string): Promise<ApiKeysOverview> => ipcRenderer.invoke(IPC.keysResetLimit, provider, id)
  },
  youtube: {
    status: (): Promise<YoutubeAccountStatus> => ipcRenderer.invoke(IPC.ytStatus),
    setCredentials: (clientId: string, clientSecret: string): Promise<YoutubeAccountStatus> =>
      ipcRenderer.invoke(IPC.ytSetCredentials, clientId, clientSecret),
    connect: (): Promise<YoutubeAccountStatus> => ipcRenderer.invoke(IPC.ytConnect),
    cancelConnect: (): Promise<void> => ipcRenderer.invoke(IPC.ytCancelConnect),
    check: (channelId: string): Promise<YoutubeAccountStatus> => ipcRenderer.invoke(IPC.ytCheck, channelId),
    disconnect: (channelId: string): Promise<YoutubeDisconnectResult> => ipcRenderer.invoke(IPC.ytDisconnect, channelId),
    clearCredentials: (): Promise<YoutubeDisconnectResult> => ipcRenderer.invoke(IPC.ytClearCredentials),
    setSlots: (channelId: string, times: string[]): Promise<YoutubeAccountStatus> => ipcRenderer.invoke(IPC.ytSetSlots, channelId, times)
  },
  modes: {
    voices: (): Promise<VoiceCatalog> => ipcRenderer.invoke(IPC.modeVoices),
    suggestTopics: (req: SuggestTopicsRequest): Promise<TopicSuggestion[]> => ipcRenderer.invoke(IPC.modeSuggestTopics, req)
  },
  production: {
    snapshot: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodSnapshot),
    enqueue: (req: ProductionEnqueueRequest): Promise<number[]> => ipcRenderer.invoke(IPC.prodEnqueue, req),
    cancel: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodCancel, id),
    retry: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodRetry, id),
    remove: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodRemove, id),
    pause: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodPause),
    resume: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodResume),
    open: (id: number, what: 'file' | 'folder'): Promise<void> => ipcRenderer.invoke(IPC.prodOpen, id, what),
    detail: (id: number): Promise<ProductionDetail | null> => ipcRenderer.invoke(IPC.prodDetail, id),
    publish: (req: ProductionPublishRequest): Promise<ProductionPublishResult> => ipcRenderer.invoke(IPC.prodPublish, req),
    /** Buka dialog pilih gambar; mengembalikan pratinjau (data URL) atau null bila dibatalkan. */
    pickThumbnail: (id: number): Promise<string | null> => ipcRenderer.invoke(IPC.prodPickThumbnail, id)
  },
  queue: {
    snapshot: (): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueSnapshot),
    retry: (id: number): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueRetry, id),
    remove: (id: number): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueRemove, id),
    cancelCurrent: (): Promise<void> => ipcRenderer.invoke(IPC.queueCancelCurrent),
    pause: (): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queuePause),
    resume: (): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueResume),
    /** Buka video di YouTube Studio (hanya item yang sudah terunggah). */
    openVideo: (id: number): Promise<void> => ipcRenderer.invoke(IPC.queueOpenVideo, id),
    /** Hanya ada handler-nya di build pengembangan dengan YOUFARM_DEV_ENQUEUE; di rilis memanggilnya akan ditolak. */
    devEnqueue: (req: EnqueueRequest): Promise<number> => ipcRenderer.invoke('queue:dev-enqueue', req)
  }
}

export type YouFarmApi = typeof api

contextBridge.exposeInMainWorld('youfarm', api)
