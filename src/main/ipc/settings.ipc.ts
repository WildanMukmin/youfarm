import { ipcMain } from 'electron'
import { IPC, type SecretStatus, type Settings } from '@shared/ipc-channels'
import type { ApiKeysOverview } from '@shared/api-keys'
import type { FootageInfo } from '@shared/footage'
import { isSecretKey, type SecretKey } from '@shared/settings'
import { getSettings, updateSettings } from '../platform/settings'
import { getApiKeys, secretStatus } from '../platform/secrets'
import { footageRoot, getFootageLibrary } from '../platform/footage'

function provider(name: unknown): SecretKey {
  if (!isSecretKey(name)) throw new Error('Nama penyedia tidak dikenal.')
  return name
}

function keyId(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{1,32}$/.test(id)) throw new Error('Key tidak valid.')
  return id
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.settingsGet, (): Settings => getSettings())
  ipcMain.handle(IPC.settingsUpdate, (_e, patch: unknown): Settings => updateSettings(patch))

  ipcMain.handle(IPC.secretsStatus, (): SecretStatus => secretStatus())

  ipcMain.handle(IPC.footageStats, (): FootageInfo => ({ ...getFootageLibrary().stats(), root: footageRoot() }))
  ipcMain.handle(IPC.footageClear, async (): Promise<FootageInfo> => {
    await getFootageLibrary().clear()
    return { ...getFootageLibrary().stats(), root: footageRoot() }
  })

  // Semua perubahan key mengembalikan daftar terbaru. Nilai key tidak pernah dikirim ke renderer.
  ipcMain.handle(IPC.keysOverview, (): ApiKeysOverview => getApiKeys().overview())

  ipcMain.handle(IPC.keysAdd, (_e, name: unknown, label: unknown, value: unknown): ApiKeysOverview => {
    if (typeof value !== 'string' || value.trim().length < 8 || value.length > 500) throw new Error('Nilai key tidak valid.')
    getApiKeys().add(provider(name), label, value.trim())
    return getApiKeys().overview()
  })

  ipcMain.handle(IPC.keysRemove, (_e, name: unknown, id: unknown): ApiKeysOverview => {
    getApiKeys().remove(provider(name), keyId(id))
    return getApiKeys().overview()
  })

  ipcMain.handle(IPC.keysSelect, (_e, name: unknown, id: unknown): ApiKeysOverview => {
    getApiKeys().select(provider(name), keyId(id))
    return getApiKeys().overview()
  })

  ipcMain.handle(IPC.keysRename, (_e, name: unknown, id: unknown, label: unknown): ApiKeysOverview => {
    getApiKeys().rename(provider(name), keyId(id), label)
    return getApiKeys().overview()
  })

  ipcMain.handle(IPC.keysSetAuto, (_e, name: unknown, auto: unknown): ApiKeysOverview => {
    getApiKeys().setAuto(provider(name), auto === true)
    return getApiKeys().overview()
  })

  ipcMain.handle(IPC.keysResetLimit, (_e, name: unknown, id: unknown): ApiKeysOverview => {
    getApiKeys().resetLimit(provider(name), keyId(id))
    return getApiKeys().overview()
  })
}
