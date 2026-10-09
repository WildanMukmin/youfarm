import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { VoiceOption } from '@shared/languages'
import { getElevenLabs } from '../platform/ai/clients'
import { listGeminiModels, listGroqModels } from '../platform/ai/models'

export function registerAiIpc(): void {
  ipcMain.handle(IPC.aiElevenLabsVoices, (): Promise<VoiceOption[]> => getElevenLabs().voices())
  ipcMain.handle(IPC.aiGeminiModels, (): Promise<string[]> => listGeminiModels())
  ipcMain.handle(IPC.aiGroqModels, (): Promise<string[]> => listGroqModels())
}
