import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiKeys } from '../../src/main/platform/api-keys.ts'
import { createSecretStore, type Codec } from '../../src/main/platform/secret-store.ts'
import { createGeminiClient, GeminiError } from '../../src/main/platform/ai/gemini-client.ts'
import { withRotation } from '../../src/main/platform/ai/rotation.ts'

const codec: Codec = { encrypt: (p) => Buffer.from(p).toString('base64'), decrypt: (c) => Buffer.from(c, 'base64').toString() }

const DAILY = { error: { message: 'quota', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }
const PER_MINUTE = { error: { message: 'quota', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }] } }
const OK = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }

/** Server palsu: tiap key punya jawaban sendiri, dan urutan key yang dipakai dicatat. */
async function setup(answers: Record<string, { status: number; body: unknown }>) {
  const used: string[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const key = String(req.headers['x-goog-api-key'])
    used.push(key)
    const a = answers[key] ?? { status: 200, body: OK }
    res.writeHead(a.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(a.body))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const dir = mkdtempSync(join(tmpdir(), 'yf-rot-'))
  const keys = createApiKeys({ metaFile: join(dir, 'k.json'), secrets: createSecretStore(join(dir, 's.json'), codec) })
  const client = withRotation(
    createGeminiClient({ apiKey: () => keys.current('gemini'), base, retryDelayMs: 1, onRateLimit: () => keys.reportLimit('gemini', 'rate') }),
    (kind) => keys.reportLimit('gemini', kind)
  )
  return { keys, client, used, close: () => (server.close(), rmSync(dir, { recursive: true, force: true })) }
}

const ask = (c: { completeJson: (p: { model: string; system: string; user: string }) => Promise<unknown> }) => c.completeJson({ model: 'm', system: '', user: '' })

test('rotasi: kuota harian habis di key pertama, permintaan diulang dengan key kedua', async () => {
  const t = await setup({ AAAAAAAA: { status: 429, body: DAILY } })
  try {
    t.keys.add('gemini', 'A', 'AAAAAAAA')
    t.keys.add('gemini', 'B', 'BBBBBBBB')
    assert.deepEqual(await ask(t.client), { ok: true })
    assert.deepEqual(t.used, ['AAAAAAAA', 'BBBBBBBB'])
    assert.equal(t.keys.current('gemini'), 'BBBBBBBB', 'key kedua kini yang dipakai')
    assert.equal(t.keys.overview().gemini.keys[0].limited, true)

    // Permintaan berikutnya langsung memakai key kedua.
    await ask(t.client)
    assert.equal(t.used.at(-1), 'BBBBBBBB')
    assert.equal(t.used.length, 3)
  } finally {
    t.close()
  }
})

test('rotasi: batas per menit pindah key seketika tanpa menunggu retryDelay Google', async () => {
  const t = await setup({ AAAAAAAA: { status: 429, body: PER_MINUTE } })
  try {
    t.keys.add('gemini', 'A', 'AAAAAAAA')
    t.keys.add('gemini', 'B', 'BBBBBBBB')
    const started = Date.now()
    assert.deepEqual(await ask(t.client), { ok: true })
    assert.ok(Date.now() - started < 3000, 'tidak menunggu 30 detik')
    assert.deepEqual(t.used, ['AAAAAAAA', 'BBBBBBBB'])
  } finally {
    t.close()
  }
})

test('rotasi: ganti otomatis mati atau hanya satu key, error asli tetap muncul', async () => {
  const t = await setup({ AAAAAAAA: { status: 429, body: DAILY } })
  try {
    t.keys.add('gemini', 'A', 'AAAAAAAA')
    await assert.rejects(ask(t.client), (e: unknown) => e instanceof GeminiError && e.kind === 'quota')

    t.keys.add('gemini', 'B', 'BBBBBBBB')
    t.keys.resetLimit('gemini', t.keys.overview().gemini.keys[0].id)
    t.keys.setAuto('gemini', false)
    t.used.length = 0
    await assert.rejects(ask(t.client), (e: unknown) => e instanceof GeminiError && e.kind === 'quota')
    assert.deepEqual(t.used, ['AAAAAAAA'], 'auto mati: key B tidak disentuh')
  } finally {
    t.close()
  }
})

test('rotasi: semua key habis berhenti di error kuota; key salah (bukan batas) tidak memicu pindah', async () => {
  const all = await setup({ AAAAAAAA: { status: 429, body: DAILY }, BBBBBBBB: { status: 429, body: DAILY } })
  try {
    all.keys.add('gemini', 'A', 'AAAAAAAA')
    all.keys.add('gemini', 'B', 'BBBBBBBB')
    await assert.rejects(ask(all.client), (e: unknown) => e instanceof GeminiError && e.kind === 'quota')
    assert.deepEqual(all.used, ['AAAAAAAA', 'BBBBBBBB'])
  } finally {
    all.close()
  }

  const bad = await setup({ AAAAAAAA: { status: 400, body: { error: { message: 'API key not valid.' } } } })
  try {
    bad.keys.add('gemini', 'A', 'AAAAAAAA')
    bad.keys.add('gemini', 'B', 'BBBBBBBB')
    await assert.rejects(ask(bad.client), (e: unknown) => e instanceof GeminiError && e.kind === 'key')
    assert.deepEqual(bad.used, ['AAAAAAAA'])
  } finally {
    bad.close()
  }
})
