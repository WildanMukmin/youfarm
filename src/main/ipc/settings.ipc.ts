import { ipcMain } from 'electron'
import { IPC, type SecretStatus, type Settings } from '@shared/ipc-channels'
import { isSecretKey } from '@shared/settings'
import { getSettings, updateSettings } from '../platform/settings'
import { clearSecret, secretStatus, setSecret } from '../platform/secrets'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.settingsGet, (): Settings => getSettings())
  ipcMain.handle(IPC.settingsUpdate, (_e, patch: unknown): Settings => updateSettings(patch))

  ipcMain.handle(IPC.secretsStatus, (): SecretStatus => secretStatus())

  ipcMain.handle(IPC.secretsSet, (_e, name: unknown, value: unknown): SecretStatus => {
    if (!isSecretKey(name)) throw new Error('Nama key tidak dikenal.')
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500) throw new Error('Nilai key tidak valid.')
    setSecret(name, value.trim())
    return secretStatus()
  })

  ipcMain.handle(IPC.secretsClear, (_e, name: unknown): SecretStatus => {
    if (!isSecretKey(name)) throw new Error('Nama key tidak dikenal.')
    clearSecret(name)
    // Pilihan provider yang bergantung pada key ini dikembalikan ke default.
    updateSettings({})
    return secretStatus()
  })
}
