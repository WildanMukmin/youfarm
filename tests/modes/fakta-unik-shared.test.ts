import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_OPTIONS,
  buildScriptPrompt,
  parseScript,
  scriptLengthWarning,
  targetWords,
  validateOptions,
  wordCount
} from '../../src/shared/modes/fakta-unik.ts'
import { createJobRegistry, isJobId } from '../../src/main/modes/jobs.ts'
import type { RenderedVideo } from '../../src/shared/contracts/modes.ts'

test('validateOptions: topik wajib, nilai tak valid kembali ke bawaan, avoid dirapikan', () => {
  assert.throws(() => validateOptions({ topic: 'ab' }), /minimal 3/)
  assert.throws(() => validateOptions({ topic: 'x'.repeat(201) }), /terlalu panjang/)
  assert.throws(() => validateOptions(null), /minimal 3/)

  const o = validateOptions({ topic: '  fakta   laut  ', language: 'fr', targetSec: 99, voiceSource: 'x', captionStyle: 'neon', avoid: ['  a ', '', 5, 'b'], voiceName: ' Kore ' })
  assert.equal(o.topic, 'fakta laut')
  assert.equal(o.language, DEFAULT_OPTIONS.language)
  assert.equal(o.targetSec, DEFAULT_OPTIONS.targetSec)
  assert.equal(o.voiceSource, DEFAULT_OPTIONS.voiceSource)
  assert.equal(o.captionStyle, DEFAULT_OPTIONS.captionStyle)
  assert.deepEqual(o.avoid, ['a', 'b'])
  assert.equal(o.voiceName, 'Kore')
})

test('buildScriptPrompt: memuat topik, bahasa, jumlah kata target, dan daftar yang dihindari', () => {
  const o = validateOptions({ topic: 'fakta laut dalam', language: 'en', targetSec: 30, avoid: ['gurita'] })
  const { system, user } = buildScriptPrompt(o)
  assert.match(user, /Topik: fakta laut dalam/)
  assert.match(user, /English/)
  assert.match(user, new RegExp(`${targetWords(o)} kata`))
  assert.match(user, /"gurita"/)
  assert.match(system, /JSON/)
  assert.ok(!/Jangan membahas/.test(buildScriptPrompt(validateOptions({ topic: 'fakta laut' })).user))
})

test('parseScript: bentuk valid diterima dan dirapikan', () => {
  const s = parseScript({
    title: '  Judul   Uji ',
    sentences: [
      { text: ' Kalimat   satu. ', keywords: ['a', ' b ', '', 'c', 'd', 'e'] },
      { text: 'Kalimat dua.', keywords: [] },
      { text: '', keywords: ['x'] },
      { text: 'Kalimat tiga.', keywords: ['z'] }
    ],
    description: ' deskripsi ',
    tags: ['t1', ' ', 't2']
  })
  assert.equal(s.title, 'Judul Uji')
  assert.equal(s.sentences.length, 3)
  assert.deepEqual(s.sentences[0], { text: 'Kalimat satu.', keywords: ['a', 'b', 'c', 'd'] })
  assert.deepEqual(s.sentences[1].keywords, ['Judul Uji'], 'tanpa kata kunci, memakai judul sebagai cadangan')
  assert.equal(s.description, 'deskripsi')
  assert.deepEqual(s.tags, ['t1', 't2'])
})

test('parseScript: menolak bentuk yang tidak bisa dipakai', () => {
  assert.throws(() => parseScript({}), /judul/)
  assert.throws(() => parseScript({ title: 'x', sentences: [{ text: 'a' }, { text: 'b' }] }), /terlalu pendek/)
  assert.throws(() => parseScript('bukan objek'), /judul/)
  const many = parseScript({ title: 'x', sentences: Array.from({ length: 30 }, (_, i) => ({ text: `k${i}`, keywords: ['a'] })) })
  assert.equal(many.sentences.length, 14, 'dibatasi 14 kalimat')
})

test('scriptLengthWarning: peringatan hanya bila jauh dari target', () => {
  const mk = (words: number) => ({ title: 't', description: '', tags: [], sentences: [{ text: Array.from({ length: words }, () => 'kata').join(' '), keywords: ['a'] }] })
  const opt = { language: 'id', targetSec: 45 } as const
  assert.equal(wordCount('satu dua  tiga'), 3)
  assert.equal(scriptLengthWarning(mk(targetWords(opt)), opt), null)
  assert.match(scriptLengthWarning(mk(20), opt) ?? '', /pendek/)
  assert.match(scriptLengthWarning(mk(400), opt) ?? '', /panjang/)
})

test('jobs: pembatalan per job, hasil dibatasi, id divalidasi', () => {
  const jobs = createJobRegistry()
  const a = jobs.start('job-aaaaaaaa')
  const b = jobs.start('job-bbbbbbbb')
  assert.throws(() => jobs.start('job-aaaaaaaa'), /sudah berjalan/)
  assert.equal(jobs.cancel('job-aaaaaaaa'), true)
  assert.equal(a.aborted, true)
  assert.equal(b.aborted, false, 'membatalkan satu job tidak menghentikan job lain')
  assert.equal(jobs.cancel('tidak-ada-xx'), false)
  jobs.cancelAll()
  assert.equal(b.aborted, true)
  jobs.finish('job-aaaaaaaa')
  assert.equal(jobs.isRunning('job-aaaaaaaa'), false)

  const video = { filePath: 'x.mp4' } as RenderedVideo
  for (let i = 0; i < 60; i++) jobs.save({ jobId: `res-${String(i).padStart(8, '0')}`, video, description: '', tags: [] })
  assert.equal(jobs.get('res-00000000'), undefined, 'hasil terlama dibuang')
  assert.ok(jobs.get('res-00000059'))

  assert.equal(isJobId('3f2a-4b5c-aaaa'), true)
  assert.equal(isJobId('../../etc'), false)
  assert.equal(isJobId('pendek'), false)
  assert.equal(isJobId(5), false)
})
