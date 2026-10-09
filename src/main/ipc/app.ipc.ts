import { app, ipcMain } from 'electron'
import { IPC, type AppInfo } from '@shared/ipc-channels'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC.appInfo,
    (): AppInfo => ({ name: app.getName(), version: app.getVersion(), platform: process.platform })
  )
}
