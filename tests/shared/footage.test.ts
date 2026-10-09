import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PHRASES, RECENT_WINDOW, matchScore, mergePhrases, normalizePhrase, pickAmongTop, rankLocal, termsOf, type LocalClip } from '../../src/shared/footage.ts'

const clip = (id: number, phrases: string[], over: Partial<LocalClip> = {}): LocalClip => ({ provider: 'pixabay', id, path: `p${id}.mp4`, duration: 8, width: 1080, height: 1920, phrases, uses: 0, lastSeq: 0, ...over })
const none = new Set<number>()

test('normalizePhrase dan termsOf: huruf kecil, tanda baca dan kata sambung dibuang', () => {
  assert.equal(normalizePhrase('  Deep   OCEAN, waves! '), 'deep ocean waves')
  assert.deepEqual([...termsOf('the deep ocean of a sea')].sort(), ['deep', 'ocean', 'sea'])
})

test('matchScore: kemiripan kata, frasa terbaik yang dihitung', () => {
  assert.equal(matchScore(['deep ocean'], ['deep ocean']), 1)
  assert.ok(Math.abs(matchScore(['ocean'], ['deep ocean']) - 0.5) < 1e-9)
  assert.equal(matchScore(['forest trail'], ['deep ocean']), 0)
  assert.equal(matchScore([], ['deep ocean']), 0)
  assert.equal(matchScore(['forest trail', 'deep ocean'], ['deep ocean waves']) > 0.6, true)
})

test('rankLocal: hanya yang cocok, belum dipakai di video ini, dan tidak baru dipakai', () => {
  const clips = [
    clip(1, ['deep ocean']),
    clip(2, ['forest trail']),
    clip(3, ['deep ocean'], { lastSeq: 95 }), // baru dipakai (video 100, jendela 10)
    clip(4, ['deep ocean'], { lastSeq: 80 }), // sudah lama
    clip(5, ['ocean waves'])
  ]
  const ids = (r: LocalClip[]) => r.map((c) => c.id)
  const base = { neededSec: 5, used: none, seq: 100 }
  assert.deepEqual(ids(rankLocal(clips, ['deep ocean'], base)).sort(), [1, 4])
  assert.deepEqual(ids(rankLocal(clips, ['deep ocean'], { ...base, used: new Set([1]) })), [4])
  assert.ok(ids(rankLocal(clips, ['deep ocean'], { ...base, relaxed: true })).includes(3), 'cadangan: yang baru dipakai boleh')
  assert.ok(ids(rankLocal(clips, ['deep ocean'], { ...base, relaxed: true })).includes(5), 'cadangan: kecocokan lebih longgar')
  assert.equal(RECENT_WINDOW, 10)
})

test('rankLocal: yang jarang dipakai dan vertikal didahulukan', () => {
  const clips = [clip(1, ['sea'], { uses: 8 }), clip(2, ['sea'], { uses: 0 }), clip(3, ['sea'], { uses: 0, width: 1920, height: 1080 })]
  assert.deepEqual(rankLocal(clips, ['sea'], { neededSec: 5, used: none, seq: 1 }).map((c) => c.id), [2, 3, 1])
})

test('pickAmongTop: acak di antara tiga teratas, kosong memberi null', () => {
  const r = ['a', 'b', 'c', 'd']
  assert.equal(pickAmongTop(r, () => 0), 'a')
  assert.equal(pickAmongTop(r, () => 0.5), 'b')
  assert.equal(pickAmongTop(r, () => 0.99), 'c')
  assert.equal(pickAmongTop([], () => 0.5), null)
})

test('mergePhrases: unik, terbaru di depan, dibatasi', () => {
  assert.deepEqual(mergePhrases(['a b', 'c d'], ['C D!', 'e f']), ['c d', 'e f', 'a b'])
  assert.equal(mergePhrases(Array.from({ length: 30 }, (_, i) => `frasa ${i}`), []).length, MAX_PHRASES)
})
