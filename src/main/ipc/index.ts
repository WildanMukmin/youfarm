import { registerAiIpc } from './ai.ipc'
import { registerAppIpc } from './app.ipc'
import { registerDialogIpc } from './dialog.ipc'
import { registerModesIpc } from './modes.ipc'
import { registerProductionIpc } from './production.ipc'
import { registerQueueIpc } from './queue.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerYoutubeIpc } from './youtube.ipc'

/** Daftarkan semua handler IPC. Satu file per domain, tanpa logika bisnis. */
export function registerIpc(): void {
  registerAppIpc()
  registerSettingsIpc()
  registerDialogIpc()
  registerAiIpc()
  registerYoutubeIpc()
  registerQueueIpc()
  registerModesIpc()
  registerProductionIpc()
}
