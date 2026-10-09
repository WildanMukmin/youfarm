import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disclosureFor } from '../../src/shared/contracts/modes.ts'
import { buildUploadBody, normalizeTags, sanitizeDescription, sanitizeTitle, type UploadInput } from '../../src/shared/youtube/metadata.ts'
import { nextFreeSlots, normalizeSlots, randomGapMs } from '../../src/shared/youtube/schedule.ts'
import { nextQuotaReset, quotaDay } from '../../src/shared/youtube/quota.ts'
import { classifyYoutubeError, reasonFromBody } from '../../src/shared/youtube/errors.ts'

const NOW = new Date('2026-10-08T10:00:00Z')
const base: UploadInput = {
  title: 'Fakta Unik <b>Laut</b>',
  description: 'Deskripsi',
  tags: ['laut', 'Laut', '#fakta', ' ', 'fakta unik'],
  categoryId: '27',
  madeForKids: false,
  containsSyntheticMedia: true,
  privacy: 'public'
}

test('disclosureFor: Kids otomatis madeForKids, Animasi 3D selalu sintetis, mode lain mengikuti produksi', () => {
  assert.deepEqual(disclosureFor('kids', false), { madeForKids: true, containsSyntheticMedia: true })
  assert.deepEqual(disclosureFor('animasi-3d', false), { madeForKids: false, containsSyntheticMedia: true })
  assert.deepEqual(disclosureFor('fakta-unik', false), { madeForKids: false, containsSyntheticMedia: false })
  assert.deepEqual(disclosureFor('fakta-unik', true), { madeForKids: false, containsSyntheticMedia: true })
})

test('sanitize: buang < >, batasi 100 karakter judul dan 5000 byte deskripsi', () => {
  assert.equal(sanitizeTitle('  a <b>  c\n d '), 'a b c d')
  assert.equal([...sanitizeTitle('x'.repeat(300))].length, 100)
  assert.equal(sanitizeTitle('😀'.repeat(150)).length, 200) // 100 emoji, tidak terpotong di tengah
  const long = sanitizeDescription('é'.repeat(4000))
  assert.ok(new TextEncoder().encode(long).length <= 5000)
  assert.ok(!long.includes('�'))
})

test('normalizeTags: dedupe tanpa peduli huruf besar, buang #, kosong, dan batasi total', () => {
  assert.deepEqual(normalizeTags(base.tags), ['laut', 'fakta', 'fakta unik'])
  const many = normalizeTags(Array.from({ length: 200 }, (_, i) => `tag-nomor-${i}-panjang`))
  assert.ok(many.join(',').length <= 500)
  assert.ok(many.length > 10 && many.length < 200)
})

test('buildUploadBody: field kepatuhan dan kategori masuk ke body', () => {
  const b = buildUploadBody({ ...base, madeForKids: true, defaultLanguage: 'id' }, NOW)
  assert.equal(b.snippet.title, 'Fakta Unik bLaut/b')
  assert.equal(b.snippet.categoryId, '27')
  assert.equal(b.snippet.defaultLanguage, 'id')
  assert.equal(b.status.selfDeclaredMadeForKids, true)
  assert.equal(b.status.containsSyntheticMedia, true)
  assert.equal(b.status.privacyStatus, 'public')
  assert.ok(!('publishAt' in b.status))
})

test('buildUploadBody: jadwal memaksa private dan menolak waktu terlalu dekat atau rusak', () => {
  const ok = buildUploadBody({ ...base, publishAt: '2026-10-09T00:00:00Z' }, NOW)
  assert.equal(ok.status.privacyStatus, 'private')
  assert.equal(ok.status.publishAt, '2026-10-09T00:00:00.000Z')
  assert.throws(() => buildUploadBody({ ...base, publishAt: '2026-10-08T10:10:00Z' }, NOW), /minimal 15 menit/)
  assert.throws(() => buildUploadBody({ ...base, publishAt: 'bukan tanggal' }, NOW), /tidak valid/)
  assert.throws(() => buildUploadBody({ ...base, title: '<>' }, NOW), /Judul/)
  assert.throws(() => buildUploadBody({ ...base, categoryId: '999' }, NOW), /Kategori/)
})

test('slot: normalisasi, WIB 07:00 = 00:00 UTC, melewati slot lampau dan yang terisi', () => {
  assert.deepEqual(normalizeSlots(['19:00', '07:00', '07:00', '25:00', 'x']), ['07:00', '19:00'])

  const WIB = -420
  // Sekarang 08 Okt 10:00 UTC = 17:00 WIB. Slot berikutnya: 19:00 WIB (12:00 UTC), lalu 07:00 WIB besok (00:00 UTC 9 Okt).
  assert.deepEqual(nextFreeSlots({ times: ['07:00', '19:00'], occupied: [], now: NOW, count: 3, tzOffsetMin: WIB }), [
    '2026-10-08T12:00:00.000Z',
    '2026-10-09T00:00:00.000Z',
    '2026-10-09T12:00:00.000Z'
  ])
  // Slot 19:00 sudah terisi -> dilewati.
  assert.deepEqual(
    nextFreeSlots({ times: ['07:00', '19:00'], occupied: ['2026-10-08T12:00:00Z'], now: NOW, count: 1, tzOffsetMin: WIB }),
    ['2026-10-09T00:00:00.000Z']
  )
  // Slot yang kurang dari 15 menit lagi dilewati: 17:00 WIB sekarang, slot 17:10 tidak boleh dipakai.
  assert.deepEqual(nextFreeSlots({ times: ['17:10', '20:00'], occupied: [], now: NOW, count: 1, tzOffsetMin: WIB }), ['2026-10-08T13:00:00.000Z'])
  assert.deepEqual(nextFreeSlots({ times: [], occupied: [], now: NOW, count: 2, tzOffsetMin: WIB }), [])
})

test('slot: zona waktu barat (UTC-5) dan lintas tengah malam lokal', () => {
  const EST = 300
  // 10:00 UTC = 05:00 lokal. Slot 06:00 lokal = 11:00 UTC masih memenuhi jeda 15 menit.
  assert.deepEqual(nextFreeSlots({ times: ['06:00'], occupied: [], now: NOW, count: 2, tzOffsetMin: EST }), [
    '2026-10-08T11:00:00.000Z',
    '2026-10-09T11:00:00.000Z'
  ])
})

test('randomGapMs berada di rentang dan menerima batas terbalik', () => {
  assert.equal(randomGapMs(0, 30, 90), 30_000)
  assert.equal(randomGapMs(0.5, 30, 90), 60_000)
  assert.equal(randomGapMs(0.999999, 90, 30), 90_000)
})

test('quotaDay mengikuti zona Pasifik dan nextQuotaReset tepat di tengah malamnya', () => {
  // 08 Okt 2026 05:00 UTC masih 07 Okt 22:00 PDT.
  assert.equal(quotaDay(new Date('2026-10-08T05:00:00Z')), '2026-10-07')
  assert.equal(quotaDay(new Date('2026-10-08T07:00:00Z')), '2026-10-08')
  // Tengah malam PDT (UTC-7) = 07:00 UTC.
  assert.equal(nextQuotaReset(new Date('2026-10-08T05:00:00Z')).toISOString(), '2026-10-08T07:00:00.000Z')
  // Setelah DST berakhir (UTC-8): tengah malam PST = 08:00 UTC.
  assert.equal(nextQuotaReset(new Date('2026-12-01T12:00:00Z')).toISOString(), '2026-12-02T08:00:00.000Z')
})

test('klasifikasi error: retry / quota / account / item', () => {
  assert.equal(classifyYoutubeError({ network: true }).kind, 'retry')
  assert.equal(classifyYoutubeError({ status: 503 }).kind, 'retry')
  assert.equal(classifyYoutubeError({ status: 403, reason: 'quotaExceeded' }).kind, 'quota')
  assert.deepEqual([classifyYoutubeError({ status: 400, reason: 'uploadLimitExceeded' }).kind, classifyYoutubeError({ status: 400, reason: 'uploadLimitExceeded' }).scope], ['quota', 'channel'])
  assert.equal(classifyYoutubeError({ status: 403, reason: 'quotaExceeded' }).scope, 'project')
  assert.equal(classifyYoutubeError({ status: 403, reason: 'rateLimitExceeded' }).kind, 'retry')
  assert.equal(classifyYoutubeError({ status: 401 }).kind, 'account')
  assert.equal(classifyYoutubeError({ status: 403, reason: 'insufficientPermissions' }).kind, 'account')
  assert.equal(classifyYoutubeError({ status: 400, reason: 'invalidTitle' }).kind, 'item')
  assert.equal(classifyYoutubeError({ status: 400 }).kind, 'item')
  assert.equal(classifyYoutubeError({ status: 403 }).kind, 'account')
  assert.equal(reasonFromBody({ error: { errors: [{ reason: 'quotaExceeded' }] } }), 'quotaExceeded')
  assert.equal(reasonFromBody({ error: 'invalid_grant' }), 'invalid_grant')
  assert.equal(reasonFromBody(null), '')
})
