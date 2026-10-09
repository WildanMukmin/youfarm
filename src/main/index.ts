import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { initDb } from './platform/db'
import { registerMediaScheme } from './platform/media-protocol'
import { startUploadQueue } from './youtube/queue'
import { startProductionQueue } from './production'

const BG = '#0B0709'

/**
 * Uji otomatis tidak boleh menyentuh data pengguna. Di build pengembangan, setiap variabel uji
 * (server palsu, enqueue uji) memindahkan folder data ke profil terpisah, kecuali
 * YOUFARM_USER_DATA menentukan folder sendiri.
 */
function isolateTestProfile(): void {
  if (app.isPackaged) return
  const explicit = process.env['YOUFARM_USER_DATA']
  const testing = ['YOUFARM_FAKE_GOOGLE', 'YOUFARM_FAKE_GEMINI', 'YOUFARM_FAKE_PEXELS', 'YOUFARM_DEV_ENQUEUE', 'YOUFARM_AUTH_URL_FILE'].some((k) => process.env[k])
  if (explicit) app.setPath('userData', explicit)
  else if (testing) app.setPath('userData', join(app.getPath('appData'), 'youfarm-test'))
}

isolateTestProfile()
registerMediaScheme()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: BG,
    show: false,
    autoHideMenuBar: true,
    icon: join(app.getAppPath(), 'assets/icons/app/icon.png'),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await initDb()
  registerIpc()
  startUploadQueue()
  startProductionQueue()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
