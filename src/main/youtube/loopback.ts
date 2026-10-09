import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CONNECT_CANCELLED_MESSAGE, deniedMessage, parseRedirect } from '../../shared/youtube/oauth.ts'

export const CONNECT_TIMEOUT_MS = 3 * 60_000

export class AuthCancelledError extends Error {
  constructor() {
    super(CONNECT_CANCELLED_MESSAGE)
  }
}

function resultPage(ok: boolean): string {
  const title = ok ? 'Akun terhubung' : 'Akun tidak terhubung'
  const body = ok ? 'Kembali ke YouFarm. Tab ini boleh ditutup.' : 'Kembali ke YouFarm untuk melihat alasannya.'
  return (
    `<!doctype html><html lang="id"><meta charset="utf-8"><title>YouFarm</title>` +
    `<body style="font-family:system-ui,sans-serif;background:#0B0709;color:#F5EBED;max-width:32rem;margin:15vh auto;padding:0 1rem">` +
    `<h1 style="font-size:1.25rem">${title}</h1><p style="color:#A59298">${body}</p></body></html>`
  )
}

/**
 * Server hanya mendengar di 127.0.0.1 dan mati begitu satu hasil valid diterima,
 * dibatalkan, atau waktunya habis. Pembuka browser disuntikkan supaya modul ini
 * tidak bergantung pada Electron.
 */
export function startAuthCodeListener(
  state: string,
  open: (redirectUri: string) => void | Promise<void>,
  timeoutMs = CONNECT_TIMEOUT_MS
): { result: Promise<{ code: string; redirectUri: string }>; cancel: () => void } {
  let cancel = (): void => undefined

  const result = new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    let redirectUri = ''
    let settled = false

    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      server.closeAllConnections()
      settle()
    }

    const server = createServer((req, res) => {
      const parsed = parseRedirect(req.url ?? '/', state)
      if (parsed.kind === 'ignore') {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(resultPage(parsed.kind === 'code'))
      if (parsed.kind === 'code') finish(() => resolve({ code: parsed.code, redirectUri }))
      else finish(() => reject(new Error(deniedMessage(parsed.error))))
    })

    const timer = setTimeout(
      () => finish(() => reject(new Error('Waktu habis menunggu izin di browser. Coba hubungkan lagi.'))),
      timeoutMs
    )

    cancel = () => finish(() => reject(new AuthCancelledError()))
    server.on('error', (err) => finish(() => reject(err)))
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      Promise.resolve()
        .then(() => open(redirectUri))
        .catch((err) => finish(() => reject(err)))
    })
  })

  return { result, cancel: () => cancel() }
}
