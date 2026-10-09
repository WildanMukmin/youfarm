import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { listGeminiModels, listGroqModels } from '../platform/ai/models'

export function registerAiIpc(): void {
  ipcMain.handle(IPC.aiGeminiModels, (): Promise<string[]> => listGeminiModels())
  ipcMain.handle(IPC.aiGroqModels, (): Promise<string[]> => listGroqModels())
}
