import { protocol } from 'electron'
import { MEDIA_SCHEME } from '@shared/media'
import { fileResponse } from './media-response'

/** Wajib dipanggil sebelum app siap. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }])
}

/**
 * `youfarm-media://prod/<id>/<kind>`. Path berkas tidak pernah datang dari renderer:
 * `resolve` hanya mengembalikan berkas yang dikenal main (hasil job), selain itu 404.
 */
export function handleMediaProtocol(resolve: (id: string, kind: string) => string | undefined): void {
  protocol.handle(MEDIA_SCHEME, (req) => {
    const u = new URL(req.url)
    const [id, kind] = u.pathname.replace(/^\/+/, '').split('/')
    const file = u.hostname === 'prod' && id && kind ? resolve(id, kind) : undefined
    if (!file) return new Response('Tidak ditemukan', { status: 404 })
    return fileResponse(file, req.headers.get('range'))
  })
}
