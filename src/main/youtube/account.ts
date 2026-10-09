import { app, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { StoredYoutube } from '@shared/youtube/accounts'
import { systemCodec } from '../platform/secrets'
import { GOOGLE_ENDPOINTS, createAccountService, type AccountService, type Endpoints } from './account-core'

const storeFile = (): string => join(app.getPath('userData'), 'youtube-accounts.json')

function readStore(): StoredYoutube {
  if (!existsSync(storeFile())) return {}
  try {
    return JSON.parse(readFileSync(storeFile(), 'utf8')) as StoredYoutube
  } catch {
    return {}
  }
}

function writeStore(store: StoredYoutube): void {
  mkdirSync(dirname(storeFile()), { recursive: true })
  const tmp = `${storeFile()}.tmp`
  writeFileSync(tmp, JSON.stringify(store))
  renameSync(tmp, storeFile())
}

/**
 * Hanya di build pengembangan: arahkan ke server Google palsu dan tulis URL login ke berkas
 * alih-alih membuka browser, supaya alur ini bisa diuji tanpa akun Google sungguhan.
 */
function devOverrides(): { endpoints?: Endpoints; authUrlFile?: string } {
  if (app.isPackaged) return {}
  const base = process.env['YOUFARM_FAKE_GOOGLE']
  return {
    endpoints: base ? { auth: `${base}/auth`, token: `${base}/token`, revoke: `${base}/revoke`, api: base } : undefined,
    authUrlFile: process.env['YOUFARM_AUTH_URL_FILE']
  }
}

/** Endpoint yang dipakai (Google asli, atau server palsu di build pengembangan). */
export function getEndpoints(): Endpoints {
  return devOverrides().endpoints ?? GOOGLE_ENDPOINTS
}

let service: AccountService | null = null

export function getAccountService(): AccountService {
  if (!service) {
    const dev = devOverrides()
    service = createAccountService({
      store: { read: readStore, write: writeStore },
      codec: systemCodec,
      endpoints: getEndpoints(),
      openUrl: (url) => {
        if (dev.authUrlFile) return writeFileSync(dev.authUrlFile, url, 'utf8')
        // Hanya http(s) yang dibuka; URL dibangun di main, bukan dari renderer.
        if (!/^https?:\/\//.test(url)) throw new Error('Alamat login tidak valid.')
        return shell.openExternal(url)
      }
    })
  }
  return service
}
