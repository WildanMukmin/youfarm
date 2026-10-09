import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { SECRET_KEYS, type SecretKey, type SecretStatus } from '@shared/settings'
import { createSecretStore, type Codec, type SecretStore } from './secret-store'

let store: SecretStore | null = null

/** Enkripsi bawaan sistem (DPAPI di Windows). Dipakai juga oleh penyimpanan token YouTube. */
export const systemCodec: Codec = {
  encrypt(plain) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Enkripsi sistem tidak tersedia, data tidak disimpan.')
    return safeStorage.encryptString(plain).toString('base64')
  },
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, 'base64'))
}

function getStore(): SecretStore {
  if (!store) store = createSecretStore(join(app.getPath('userData'), 'secrets.json'), systemCodec)
  return store
}

/** Status "sudah diisi" tanpa menampilkan nilainya. */
export function secretStatus(): SecretStatus {
  const s = getStore()
  return Object.fromEntries(SECRET_KEYS.map((k) => [k, s.has(k)])) as SecretStatus
}

export const setSecret = (name: SecretKey, value: string): void => getStore().set(name, value)
export const clearSecret = (name: SecretKey): void => getStore().clear(name)
/** Dipakai modul main (klien AI). Tidak diekspos lewat IPC. */
export const getSecret = (name: SecretKey): string | undefined => getStore().get(name)
