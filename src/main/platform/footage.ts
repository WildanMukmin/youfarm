import { app } from 'electron'
import { join } from 'node:path'
import { createFootageLibrary, type FootageLibrary } from './footage-library'
import { getDb, getKv, setKv } from './db'
import { getSettings } from './settings'

const ADOPTED_KEY = 'footage-legacy-adopted'
let library: FootageLibrary | null = null

/** Folder utama pustaka: folder impor di Settings, atau `import` di folder data aplikasi. Isinya satu subfolder per penyedia. */
export function footageRoot(): string {
  return getSettings().importDir ?? join(app.getPath('userData'), 'import')
}

/** Pustaka footage lokal. Klip disimpan di `<folder impor>/<penyedia>`, dan lokasi mengikuti Settings saat dipakai. */
export function getFootageLibrary(): FootageLibrary {
  if (!library) {
    library = createFootageLibrary({
      db: getDb(),
      dirFor: (provider) => {
        if (!/^[a-z]+$/.test(provider)) throw new Error('Penyedia footage tidak valid.')
        return join(footageRoot(), provider)
      }
    })
    // Cache lama (userData/cache/footage) dipindah sekali ke pustaka supaya ikut dikelola batas ukurannya.
    if (getKv(ADOPTED_KEY) !== '1') {
      setKv(ADOPTED_KEY, '1')
      void library.adoptLegacy(join(app.getPath('userData'), 'cache', 'footage')).catch(() => undefined)
    }
  }
  return library
}
