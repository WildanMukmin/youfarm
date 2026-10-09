import { contextBridge, ipcRenderer } from 'electron'
import type { EnqueueRequest } from '@shared/youtube/queue'
import {
  IPC,
  type AppInfo,
  type EnqueueJobRequest,
  type EnqueueJobResult,
  type ModeProgress,
  type ModeRunResult,
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
    geminiModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.aiGeminiModels)
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
    clearCredentials: (): Promise<YoutubeDisconnectResult> => ipcRenderer.invoke(IPC.ytClearCredentials)
  },
  modes: {
    run: (jobId: string, mode: string, options: unknown): Promise<ModeRunResult> => ipcRenderer.invoke(IPC.modeRun, jobId, mode, options),
    cancel: (jobId: string): Promise<boolean> => ipcRenderer.invoke(IPC.modeCancel, jobId),
    voices: (): Promise<VoiceCatalog> => ipcRenderer.invoke(IPC.modeVoices),
    open: (jobId: string, what: 'file' | 'folder'): Promise<void> => ipcRenderer.invoke(IPC.modeOpen, jobId, what),
    enqueue: (req: EnqueueJobRequest): Promise<EnqueueJobResult> => ipcRenderer.invoke(IPC.modeEnqueue, req),
    /** Dengar progres semua job. Mengembalikan fungsi untuk berhenti mendengar. */
    onProgress: (cb: (p: ModeProgress) => void): (() => void) => {
      const handler = (_e: unknown, p: ModeProgress): void => cb(p)
      ipcRenderer.on(IPC.modeProgress, handler)
      return () => ipcRenderer.removeListener(IPC.modeProgress, handler)
    }
  },
  queue: {
    snapshot: (): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueSnapshot),
    retry: (id: number): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueRetry, id),
    remove: (id: number): Promise<QueueSnapshot> => ipcRenderer.invoke(IPC.queueRemove, id),
    cancelCurrent: (): Promise<void> => ipcRenderer.invoke(IPC.queueCancelCurrent),
    /** Hanya ada handler-nya di build pengembangan dengan YOUFARM_DEV_ENQUEUE; di rilis memanggilnya akan ditolak. */
    devEnqueue: (req: EnqueueRequest): Promise<number> => ipcRenderer.invoke('queue:dev-enqueue', req)
  }
}

export type YouFarmApi = typeof api

contextBridge.exposeInMainWorld('youfarm', api)
