import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiKeys } from '../../src/main/platform/api-keys.ts'
import { createSecretStore, type Codec } from '../../src/main/platform/secret-store.ts'

const codec: Codec = { encrypt: (p) => Buffer.from(`enc:${p}`).toString('base64'), decrypt: (c) => Buffer.from(c, 'base64').toString().replace(/^enc:/, '') }

function setup(prep?: (secretsFile: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'yf-keys-'))
  const secretsFile = join(dir, 'secrets.json')
  prep?.(secretsFile)
  let t = Date.parse('2026-06-01T10:00:00.000Z')
  let n = 0
  const make = () => createApiKeys({ metaFile: join(dir, 'api-keys.json'), secrets: createSecretStore(secretsFile, codec), now: () => t, newId: () => `id${++n}` })
  return { dir, secretsFile, make, tick: (ms: number) => (t += ms) }
}

test('api-keys: tambah beberapa key, pilih, hapus; nilai key tidak bocor ke ringkasan', () => {
  const { dir, make } = setup()
  try {
    const k = make()
    k.add('gemini', ' Akun utama ', 'AIzaUTAMA1111')
    k.add('gemini', '', 'AIzaCADANG2222')
    assert.equal(k.current('gemini'), 'AIzaUTAMA1111')
    assert.deepEqual(k.status(), { gemini: true, groq: false, deepgram: false, pixabay: false, pexels: false, elevenlabs: false })

    const g = k.overview().gemini
    assert.deepEqual(g.keys.map((x) => [x.label, x.last4, x.active]), [['Akun utama', '1111', true], ['Key 2', '2222', false]])
    assert.ok(!JSON.stringify(k.overview()).includes('AIzaUTAMA'))

    k.select('gemini', g.keys[1].id)
    assert.equal(k.current('gemini'), 'AIzaCADANG2222')
    k.remove('gemini', g.keys[1].id)
    assert.equal(k.current('gemini'), 'AIzaUTAMA1111')
    assert.throws(() => k.select('gemini', 'tidak-ada'), /tidak ditemukan/)

    // Berkas di disk: nilai terenkripsi, metadata tanpa nilai.
    assert.ok(!readFileSync(join(dir, 'api-keys.json'), 'utf8').includes('AIza'))
    assert.ok(!readFileSync(join(dir, 'secrets.json'), 'utf8').includes('AIzaUTAMA1111'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('api-keys: kena batas memindah ke key lain, pulih setelah cooldown, dan bertahan setelah dibuka ulang', () => {
  const { dir, make, tick } = setup()
  try {
    const k = make()
    k.add('groq', 'A', 'gsk_aaaaaaaa')
    k.add('groq', 'B', 'gsk_bbbbbbbb')
    assert.equal(k.reportLimit('groq', 'rate'), true)
    assert.equal(k.current('groq'), 'gsk_bbbbbbbb')
    assert.equal(k.overview().groq.keys[0].limited, true)

    assert.equal(k.reportLimit('groq', 'quota'), false, 'tidak ada key siap lagi')

    // Dibuka ulang: pilihan dan tanda batas ikut.
    const again = make()
    assert.equal(again.current('groq'), 'gsk_bbbbbbbb')
    tick(2 * 60 * 1000 + 1)
    assert.equal(again.overview().groq.keys[0].limited, false, 'batas per menit pulih setelah 2 menit')
    assert.equal(again.overview().groq.keys[1].limited, true, 'batas kuota lebih lama')

    again.resetLimit('groq', again.overview().groq.keys[1].id)
    assert.equal(again.overview().groq.keys[1].limited, false)

    again.setAuto('groq', false)
    assert.equal(again.reportLimit('groq', 'rate'), false, 'auto mati: tidak pindah')
    assert.equal(again.current('groq'), 'gsk_bbbbbbbb')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('api-keys: key tunggal dari versi lama dimigrasikan jadi "Key 1"', () => {
  const { dir, make, secretsFile } = setup((file) => {
    const old = createSecretStore(file, codec)
    old.set('gemini', 'AIzaLAMA9999')
    old.set('pixabay', 'pxb-lama-0000')
  })
  try {
    const k = make()
    assert.equal(k.current('gemini'), 'AIzaLAMA9999')
    assert.equal(k.current('pixabay'), 'pxb-lama-0000')
    assert.deepEqual(k.overview().gemini.keys.map((x) => [x.label, x.last4, x.active]), [['Key 1', '9999', true]])
    // Nama lama dihapus dari secrets.json, dan migrasi tidak mengulang saat dibuka lagi.
    assert.ok(!('gemini' in JSON.parse(readFileSync(secretsFile, 'utf8'))))
    assert.equal(make().overview().gemini.keys.length, 1)
    assert.ok(existsSync(join(dir, 'api-keys.json')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('api-keys: metadata rusak diabaikan tanpa melempar', () => {
  const { dir, make } = setup()
  try {
    writeFileSync(join(dir, 'api-keys.json'), '{bukan json')
    assert.equal(make().status().gemini, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
