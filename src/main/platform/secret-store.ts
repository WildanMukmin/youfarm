import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Pengubah teks <-> teks terenkripsi (base64). Dipasang dengan safeStorage di aplikasi. */
export interface Codec {
  encrypt(plain: string): string
  decrypt(cipher: string): string
}

export interface SecretStore {
  has(name: string): boolean
  /** Hanya untuk main process. Jangan pernah dikirim ke renderer. */
  get(name: string): string | undefined
  set(name: string, value: string): void
  clear(name: string): void
}

export function createSecretStore(file: string, codec: Codec): SecretStore {
  let data: Record<string, string> = {}
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
    } catch {
      data = {}
    }
  }

  const save = (): void => {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(data))
    renameSync(tmp, file)
  }

  return {
    has: (name) => name in data,
    get(name) {
      const c = data[name]
      if (c === undefined) return undefined
      try {
        return codec.decrypt(c)
      } catch {
        return undefined
      }
    },
    set(name, value) {
      data[name] = codec.encrypt(value)
      save()
    },
    clear(name) {
      if (!(name in data)) return
      delete data[name]
      save()
    }
  }
}
