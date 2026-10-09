import { contextBridge, ipcRenderer } from 'electron'
import type { EnqueueRequest } from '@shared/youtube/queue'
import type { ProductionEnqueueRequest, ProductionSnapshot } from '@shared/production'
import type { TopicSuggestion } from '@shared/modes/fakta-unik'
import {
  IPC,
  type AppInfo,
  type EnqueueJobRequest,
  type EnqueueJobResult,
  type ModeProgress,
  type ModeRunResult,
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
    groqModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.aiGroqModels)
  },
  secrets: {
    status: (): Promise<SecretStatus> => ipcRenderer.invoke(IPC.secretsStatus),
    set: (name: SecretKey, value: string): Promise<SecretStatus> => ipcRenderer.invoke(IPC.secretsSet, name, value),
    clear: (name: SecretKey): Promise<SecretStatus> => ipcRenderer.invoke(IPC.secretsClear, name)
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
    run: (jobId: string, mode: string, options: unknown): Promise<ModeRunResult> => ipcRenderer.invoke(IPC.modeRun, jobId, mode, options),
    cancel: (jobId: string): Promise<boolean> => ipcRenderer.invoke(IPC.modeCancel, jobId),
    voices: (): Promise<VoiceCatalog> => ipcRenderer.invoke(IPC.modeVoices),
    open: (jobId: string, what: 'file' | 'folder'): Promise<void> => ipcRenderer.invoke(IPC.modeOpen, jobId, what),
    enqueue: (req: EnqueueJobRequest): Promise<EnqueueJobResult> => ipcRenderer.invoke(IPC.modeEnqueue, req),
    suggestTopics: (req: SuggestTopicsRequest): Promise<TopicSuggestion[]> => ipcRenderer.invoke(IPC.modeSuggestTopics, req),
    /** Dengar progres semua job. Mengembalikan fungsi untuk berhenti mendengar. */
    onProgress: (cb: (p: ModeProgress) => void): (() => void) => {
      const handler = (_e: unknown, p: ModeProgress): void => cb(p)
      ipcRenderer.on(IPC.modeProgress, handler)
      return () => ipcRenderer.removeListener(IPC.modeProgress, handler)
    }
  },
  production: {
    snapshot: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodSnapshot),
    enqueue: (req: ProductionEnqueueRequest): Promise<number[]> => ipcRenderer.invoke(IPC.prodEnqueue, req),
    cancel: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodCancel, id),
    retry: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodRetry, id),
    remove: (id: number): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodRemove, id),
    pause: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodPause),
    resume: (): Promise<ProductionSnapshot> => ipcRenderer.invoke(IPC.prodResume),
    open: (id: number, what: 'file' | 'folder'): Promise<void> => ipcRenderer.invoke(IPC.prodOpen, id, what)
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
