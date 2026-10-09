import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'

export function registerDialogIpc(): void {
  ipcMain.handle(IPC.dialogSelectFolder, async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts = { properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
}
