import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import type { SecretKey, SecretStatus } from '@shared/settings'
import { createApiKeys, type ApiKeys } from './api-keys'
import { createSecretStore, type Codec } from './secret-store'

let keys: ApiKeys | null = null

/** Enkripsi bawaan sistem (DPAPI di Windows). Dipakai juga oleh penyimpanan token YouTube. */
export const systemCodec: Codec = {
  encrypt(plain) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Enkripsi sistem tidak tersedia, data tidak disimpan.')
    return safeStorage.encryptString(plain).toString('base64')
  },
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, 'base64'))
}

/** Daftar key per penyedia. Nilai key terenkripsi di secrets.json; nama dan pilihan aktif di api-keys.json. */
export function getApiKeys(): ApiKeys {
  if (!keys) {
    const dir = app.getPath('userData')
    keys = createApiKeys({ metaFile: join(dir, 'api-keys.json'), secrets: createSecretStore(join(dir, 'secrets.json'), systemCodec) })
  }
  return keys
}

/** Status "sudah ada key" tanpa menampilkan nilainya. */
export const secretStatus = (): SecretStatus => getApiKeys().status()

/** Dipakai modul main (klien AI). Tidak diekspos lewat IPC. Memberi key yang sedang dipakai penyedia itu. */
export const getSecret = (name: SecretKey): string | undefined => getApiKeys().current(name)
