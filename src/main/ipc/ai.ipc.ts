import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { listGeminiModels } from '../platform/ai/gemini'

export function registerAiIpc(): void {
  ipcMain.handle(IPC.aiGeminiModels, (): Promise<string[]> => listGeminiModels())
}
