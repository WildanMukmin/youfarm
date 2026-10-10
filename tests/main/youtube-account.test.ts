import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createAccountService, type Endpoints } from '../../src/main/youtube/account-core.ts'
import {
  SCOPE_ANALYTICS,
  SCOPE_UPLOAD,
  SCOPE_EMAIL,
  SCOPE_READONLY,
  accountState,
  type StoredYoutube
} from '../../src/shared/youtube/accounts.ts'
import { buildAuthUrl, googleErrorMessage, parseRedirect } from '../../src/shared/youtube/oauth.ts'

const codec = {
  encrypt: (s: string) => Buffer.from(`enc:${s}`).toString('base64'),
  decrypt: (c: string) => Buffer.from(c, 'base64').toString().replace(/^enc:/, '')
}

const CLIENT_ID = 'abc.apps.googleusercontent.com'

interface FakeGoogle {
  endpoints: Endpoints
  server: Server
  state: { challenge: string; tokenAlive: boolean; grantedScope: string; revokeCalls: number; returnRefreshToken: boolean; channelOk: boolean }
}

function closeFake(g: FakeGoogle): void {
  g.server.close()
  g.server.closeAllConnections()
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  let body = ''
  for await (const chunk of req) body += chunk
  return new URLSearchParams(body)
}

async function startFakeGoogle(): Promise<FakeGoogle> {
  const state: FakeGoogle['state'] = {
    challenge: '',
    tokenAlive: true,
    grantedScope: [SCOPE_READONLY, SCOPE_UPLOAD, SCOPE_ANALYTICS, SCOPE_EMAIL].join(' '),
    revokeCalls: 0,
    returnRefreshToken: true,
    channelOk: true
  }
  const json = (res: import('node:http').ServerResponse, code: number, body: unknown) =>
    res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (url.pathname === '/token') {
      const f = await readForm(req)
      if (f.get('client_secret') !== 'rahasia') return json(res, 401, { error: 'invalid_client' })
      if (f.get('grant_type') === 'authorization_code') {
        const ok = createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url') === state.challenge
        if (!ok || f.get('code') !== 'kode-sah') return json(res, 400, { error: 'invalid_grant' })
        return json(res, 200, {
          access_token: 'AT-1',
          ...(state.returnRefreshToken ? { refresh_token: 'RT-1' } : {}),
          scope: state.grantedScope
        })
      }
      if (f.get('grant_type') === 'refresh_token') {
        if (f.get('refresh_token') !== 'RT-1' || !state.tokenAlive) return json(res, 400, { error: 'invalid_grant' })
        return json(res, 200, { access_token: 'AT-2' })
      }
    }
    if (url.pathname === '/revoke') {
      state.revokeCalls++
      return json(res, 200, {})
    }
    if (url.pathname === '/youtube/v3/channels') {
      if (req.headers.authorization !== 'Bearer AT-1' || !state.channelOk) return json(res, 200, { items: [] })
      return json(res, 200, { items: [{ id: 'UC123', snippet: { title: 'Kanal Uji' } }] })
    }
    if (url.pathname === '/oauth2/v3/userinfo') {
      if (req.headers.authorization !== 'Bearer AT-1') return json(res, 401, { error: 'invalid_token' })
      return json(res, 200, { sub: '1', email: 'pemilik@example.com' })
    }
    json(res, 404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { server, state, endpoints: { auth: `${base}/auth`, token: `${base}/token`, revoke: `${base}/revoke`, api: base } }
}

function makeService(g: FakeGoogle, opts: { approve?: boolean } = {}) {
  let store: StoredYoutube = {}
  const service = createAccountService({
    store: { read: () => store, write: (s) => (store = s) },
    codec,
    endpoints: g.endpoints,
    connectTimeoutMs: 3000,
    // "Browser" palsu: membaca URL login, lalu menekan redirect seperti Google.
    openUrl: async (url) => {
      const u = new URL(url)
      g.state.challenge = u.searchParams.get('code_challenge') ?? ''
      const redirect = new URL(u.searchParams.get('redirect_uri') ?? '')
      if (opts.approve === false) redirect.searchParams.set('error', 'access_denied')
      else redirect.searchParams.set('code', 'kode-sah')
      redirect.searchParams.set('state', u.searchParams.get('state') ?? '')
      setTimeout(() => void fetch(redirect), 20)
    }
  })
  return { service, getStore: () => store }
}

test('connect: alur PKCE penuh menyimpan akun dengan token terenkripsi', async () => {
  const g = await startFakeGoogle()
  try {
    const { service, getStore } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    const status = await service.connect()

    assert.equal(status.accounts.length, 1)
    assert.equal(status.accounts[0].channel.title, 'Kanal Uji')
    assert.equal(status.accounts[0].state, 'ok')
    assert.equal(status.accounts[0].canAnalytics, true)
    assert.equal(status.accounts[0].email, 'pemilik@example.com')

    const raw = JSON.stringify(getStore())
    assert.ok(!raw.includes('RT-1'), 'refresh token tidak boleh tersimpan polos')
    assert.ok(!raw.includes('"rahasia"') && !raw.includes('rahasia"'), 'secret tidak boleh tersimpan polos')
    assert.ok(!JSON.stringify(status).includes('RT-1'))
  } finally {
    closeFake(g)
  }
})

test('connect: izin email tidak diberikan -> akun tetap terhubung tanpa email', async () => {
  const g = await startFakeGoogle()
  try {
    g.state.grantedScope = [SCOPE_READONLY, SCOPE_UPLOAD, SCOPE_ANALYTICS].join(' ')
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    const status = await service.connect()
    assert.equal(status.accounts[0].email, null)
    assert.equal(status.accounts[0].state, 'ok')
  } finally {
    closeFake(g)
  }
})

test('connect: izin analitik tidak dicentang -> status needs-analytics', async () => {
  const g = await startFakeGoogle()
  try {
    g.state.grantedScope = [SCOPE_READONLY, SCOPE_UPLOAD].join(' ')
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    const status = await service.connect()
    assert.equal(status.accounts[0].state, 'needs-analytics')
    assert.equal(status.accounts[0].canUpload, true)
  } finally {
    closeFake(g)
  }
})

test('connect: izin ditolak di halaman Google', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g, { approve: false })
    service.setCredentials(CLIENT_ID, 'rahasia')
    await assert.rejects(service.connect(), /Izin ditolak/)
    assert.equal(service.status().accounts.length, 0)
  } finally {
    closeFake(g)
  }
})

test('connect: tanpa refresh token diberi petunjuk yang bisa dikerjakan', async () => {
  const g = await startFakeGoogle()
  try {
    g.state.returnRefreshToken = false
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    await assert.rejects(service.connect(), /refresh token/)
  } finally {
    closeFake(g)
  }
})

test('connect: dibatalkan pengguna', async () => {
  const g = await startFakeGoogle()
  try {
    let store: StoredYoutube = {}
    const service = createAccountService({
      store: { read: () => store, write: (s) => (store = s) },
      codec,
      endpoints: g.endpoints,
      openUrl: () => undefined
    })
    service.setCredentials(CLIENT_ID, 'rahasia')
    const p = service.connect()
    setTimeout(() => service.cancelConnect(), 30)
    await assert.rejects(p, /dibatalkan/)
  } finally {
    closeFake(g)
  }
})

test('connect: secret salah -> pesan jelas, tidak ada akun tersimpan', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'salah')
    await assert.rejects(service.connect(), /Client ID atau Client Secret/)
    assert.equal(service.status().accounts.length, 0)
  } finally {
    closeFake(g)
  }
})

test('check: token hidup, lalu mati ditandai reconnect; jaringan putus tidak dianggap mati', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    await service.connect()

    assert.equal((await service.check('UC123')).accounts[0].state, 'ok')

    g.state.tokenAlive = false
    assert.equal((await service.check('UC123')).accounts[0].state, 'reconnect')

    g.state.tokenAlive = true
    const { service: offline } = makeService({ ...g, endpoints: { ...g.endpoints, token: 'http://127.0.0.1:1/token' } })
    offline.setCredentials(CLIENT_ID, 'rahasia')
    await assert.rejects(offline.check('UC123'), /Kanal ini sudah tidak ada|Tidak bisa terhubung/)
  } finally {
    closeFake(g)
  }
})

test('disconnect: mencabut di Google dan menghapus akun; gagal cabut tetap melepas akun', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    await service.connect()
    const r = await service.disconnect('UC123')
    assert.equal(r.revoked, true)
    assert.equal(g.state.revokeCalls, 1)
    assert.equal(r.status.accounts.length, 0)

    await service.connect()
    closeFake(g)
    const r2 = await service.disconnect('UC123')
    assert.equal(r2.revoked, false)
    assert.equal(r2.status.accounts.length, 0)
  } finally {
    closeFake(g)
  }
})

test('setCredentials: validasi Client ID, ganti client menghapus akun lama', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g)
    assert.throws(() => service.setCredentials('salah', 'x'), /apps.googleusercontent.com/)
    assert.throws(() => service.setCredentials(CLIENT_ID, '  '), /Secret kosong/)
    service.setCredentials(CLIENT_ID, 'rahasia')
    await service.connect()
    service.setCredentials(CLIENT_ID, 'rahasia')
    assert.equal(service.status().accounts.length, 1)
    service.setCredentials('lain.apps.googleusercontent.com', 'rahasia')
    assert.equal(service.status().accounts.length, 0)
  } finally {
    closeFake(g)
  }
})

test('accountState dan oauth helper murni', () => {
  assert.equal(accountState({ scopes: [SCOPE_UPLOAD, SCOPE_ANALYTICS], lastCheckOk: true }), 'ok')
  assert.equal(accountState({ scopes: [SCOPE_UPLOAD, SCOPE_ANALYTICS] }), 'unchecked')
  assert.equal(accountState({ scopes: [SCOPE_UPLOAD] , lastCheckOk: true }), 'needs-analytics')
  assert.equal(accountState({ scopes: [SCOPE_ANALYTICS], lastCheckOk: true }), 'reconnect')
  assert.equal(accountState({ scopes: [SCOPE_UPLOAD, SCOPE_ANALYTICS], lastCheckOk: false }), 'reconnect')

  assert.deepEqual(parseRedirect('/?state=lain&code=x', 's'), { kind: 'ignore' })
  assert.deepEqual(parseRedirect('/?state=s&code=x', 's'), { kind: 'code', code: 'x' })
  assert.deepEqual(parseRedirect('/?state=s&error=access_denied', 's'), { kind: 'denied', error: 'access_denied' })

  const u = new URL(buildAuthUrl({ clientId: 'c', redirectUri: 'http://127.0.0.1:1', scopes: ['a', 'b'], challenge: 'ch', state: 's' }))
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('scope'), 'a b')

  assert.match(googleErrorMessage({ error: { errors: [{ reason: 'accessNotConfigured' }] } }, 403), /belum diaktifkan/)
})

test('setSlots: jam tayang tersimpan per channel dan ikut terhapus saat channel diputuskan', async () => {
  const g = await startFakeGoogle()
  try {
    const { service } = makeService(g)
    service.setCredentials(CLIENT_ID, 'rahasia')
    await service.connect()
    assert.deepEqual(service.status().accounts[0].slots, ['07:00', '12:00', '19:00'])
    assert.deepEqual(service.setSlots('UC123', ['19:00', '12:00']).accounts[0].slots, ['12:00', '19:00'])
    assert.throws(() => service.setSlots('UC123', []), /minimal satu/)
    await service.disconnect('UC123')
    await service.connect()
    assert.deepEqual(service.status().accounts[0].slots, ['07:00', '12:00', '19:00'], 'channel baru mulai dari bawaan')
  } finally {
    closeFake(g)
  }
})
