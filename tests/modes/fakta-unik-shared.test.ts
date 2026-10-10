import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_OPTIONS,
  hookEnabled,
  MAX_TARGET_SEC,
  MIN_TARGET_SEC,
  buildScriptPrompt,
  parseScript,
  buildTopicPrompt,
  parseTopics,
  scriptLengthWarning,
  sentenceRange,
  targetLength,
  validateOptions
} from '../../src/shared/modes/fakta-unik.ts'
import { CAPTION_TEMPLATES, DEFAULT_CAPTION } from '../../src/shared/captions.ts'

test('validateOptions: topik wajib, nilai tak valid kembali ke bawaan, avoid dirapikan', () => {
  assert.throws(() => validateOptions({ topic: 'ab' }), /minimal 3/)
  assert.throws(() => validateOptions({ topic: 'x'.repeat(201) }), /terlalu panjang/)
  assert.throws(() => validateOptions(null), /minimal 3/)

  const o = validateOptions({ topic: '  fakta   laut  ', language: 'xx', targetSec: 'bukan angka', voiceSource: 'x', captionStyle: 'neon', stockSource: 'shutterstock', aspect: '21:9', avoid: ['  a ', '', 5, 'b'], voiceName: ' Kore ' })
  assert.equal(o.topic, 'fakta laut')
  assert.equal(o.language, DEFAULT_OPTIONS.language)
  assert.equal(o.targetSec, DEFAULT_OPTIONS.targetSec)
  assert.equal(o.voiceSource, DEFAULT_OPTIONS.voiceSource)
  assert.equal(o.aspect, DEFAULT_OPTIONS.aspect)
  assert.deepEqual(o.caption, DEFAULT_CAPTION)
  // Durasi bebas (bukan lagi preset): dijepit ke rentangnya, bukan ditolak.
  assert.equal(validateOptions({ topic: 'fakta laut', targetSec: 99999 }).targetSec, MAX_TARGET_SEC)
  assert.equal(validateOptions({ topic: 'fakta laut', targetSec: 1 }).targetSec, MIN_TARGET_SEC)
  assert.equal(validateOptions({ topic: 'fakta laut', targetSec: 600 }).targetSec, 600, 'tanpa batas praktis')
  assert.equal(validateOptions({ topic: 'fakta laut', targetSec: 90 }).targetSec, 90)
  assert.equal(validateOptions({ topic: 'fakta laut', aspect: '16:9' }).aspect, '16:9')
  // Bahasa lain dan sumber suara baru diterima; antrean lama dengan nama preset caption tetap terbaca.
  const more = validateOptions({ topic: 'fakta laut', language: 'ja', voiceSource: 'deepgram', captionStyle: 'kotak-gelap' })
  assert.equal(more.language, 'ja')
  assert.equal(more.voiceSource, 'deepgram')
  assert.equal(more.caption.box, true)
  assert.deepEqual(more.caption, CAPTION_TEMPLATES.find((t) => t.id === 'kotak-gelap')!.style)
  // Gaya baru dijepit ke rentang yang aman.
  const cap = validateOptions({ topic: 'fakta laut', caption: { ...DEFAULT_CAPTION, size: 999, color: 'merah', font: 'Font Asing', align: 'kanan' } }).caption
  assert.deepEqual([cap.size, cap.color, cap.font, cap.align], [220, DEFAULT_CAPTION.color, DEFAULT_CAPTION.font, 'center'])
  assert.equal(o.stockSource, 'pixabay')
  assert.equal(validateOptions({ topic: 'fakta laut', stockSource: 'pexels' }).stockSource, 'pexels')
  assert.deepEqual(o.avoid, ['a', 'b'])
  assert.equal(o.voiceName, 'Kore')
})

test('buildScriptPrompt: memuat topik, bahasa, jumlah kata target, dan daftar yang dihindari', () => {
  const o = validateOptions({ topic: 'fakta laut dalam', language: 'en', targetSec: 30, avoid: ['gurita'] })
  const { system, user } = buildScriptPrompt(o)
  assert.match(user, /Topik: fakta laut dalam/)
  assert.match(user, /English/)
  assert.match(user, new RegExp(`${targetLength(o).amount} kata`))
  // Bahasa tanpa spasi diukur per karakter.
  const ja = buildScriptPrompt(validateOptions({ topic: 'fakta laut', language: 'ja', targetSec: 30 }))
  assert.match(ja.user, /210 karakter/)
  assert.match(ja.system, /日本語/)
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
  const many = parseScript({ title: 'x', sentences: Array.from({ length: 900 }, (_, i) => ({ text: `k${i}`, keywords: ['a'] })) })
  assert.equal(many.sentences.length, 720, 'dibatasi 720 kalimat')
  assert.deepEqual(sentenceRange(45), { min: 6, max: 10 })
  assert.deepEqual(sentenceRange(300), { min: 33, max: 60 })
})

test('scriptLengthWarning: peringatan hanya bila jauh dari target', () => {
  const mk = (words: number) => ({ title: 't', hook: null, hookKeywords: [], hookIssue: null, description: '', tags: [], sentences: [{ text: Array.from({ length: words }, () => 'kata').join(' '), keywords: ['a'] }] })
  const opt = { language: 'id', targetSec: 45 } as const
  assert.equal(scriptLengthWarning(mk(targetLength(opt).amount), opt), null)
  assert.match(scriptLengthWarning(mk(20), opt) ?? '', /pendek/)
  assert.match(scriptLengthWarning(mk(400), opt) ?? '', /panjang/)
  const zh = { language: 'zh', targetSec: 30 } as const
  const zhScript = { title: 't', hook: null, hookKeywords: [], hookIssue: null, description: '', tags: [], sentences: [{ text: '深海'.repeat(68) + '。', keywords: ['a'] }] }
  assert.equal(scriptLengthWarning(zhScript, zh), null, '136 karakter mendekati target 135')
})

test('saran topik: prompt memakai niche bila ada, dan hasil AI dirapikan', () => {
  const withSeed = buildTopicPrompt({ seed: '  sejarah   kuno ', language: 'id', avoid: ['Piramida Giza'] })
  assert.match(withSeed.user, /Niche: sejarah kuno\./)
  assert.match(withSeed.user, /"Piramida Giza"/)
  assert.match(withSeed.system, /JSON/)
  assert.match(buildTopicPrompt({ seed: '', language: 'en', avoid: [] }).user, /beragam/)

  const t = parseTopics({ topics: [{ topic: '1. "Rahasia piramida"', why: 'menarik' }, '7 keajaiban dunia kuno', { topic: 'rahasia Piramida' }, { topic: 'x' }, 42] })
  assert.deepEqual(t.map((x) => x.topic), ['Rahasia piramida', '7 keajaiban dunia kuno'])
  assert.equal(t[0].why, 'menarik')
  assert.throws(() => parseTopics({ topics: [] }), /tidak memberi topik/)
  assert.throws(() => parseTopics({}), /daftar topik/)
})

test('scriptLanguageMismatch: mendeteksi naskah Inggris saat dipilih Indonesia dan sebaliknya', async () => {
  const { scriptLanguageMismatch } = await import('../../src/shared/modes/fakta-unik.ts')
  const mk = (...t: string[]) => ({ title: 't', hook: null, hookKeywords: [], hookIssue: null, description: '', tags: [], sentences: t.map((text) => ({ text, keywords: ['a'] })) })
  const en = mk("Neptune's rings are thin, faint, and icy dust.", 'They formed from the debris of shattered moons.', 'Gravity is what keeps the rings in place.')
  const id = mk('Cincin Neptunus tipis dan terbuat dari debu es.', 'Cincin itu terbentuk dari sisa bulan yang hancur.', 'Gravitasi yang menjaga cincin tetap di tempatnya.')
  assert.equal(scriptLanguageMismatch(en, 'id'), true)
  assert.equal(scriptLanguageMismatch(id, 'id'), false)
  assert.equal(scriptLanguageMismatch(id, 'en'), true)
  assert.equal(scriptLanguageMismatch(en, 'en'), false)
  assert.equal(scriptLanguageMismatch(en, 'ja'), false, 'bahasa lain tidak diperiksa')
})

test('hook: opsi, prompt, dan validasi hasil AI', () => {
  assert.equal(DEFAULT_OPTIONS.hook, true)
  assert.equal(validateOptions({ topic: 'fakta laut', hook: false }).hook, false)
  assert.equal(validateOptions({ topic: 'fakta laut', hook: 'ya' }).hook, true, 'tak valid kembali ke bawaan')

  const on = validateOptions({ topic: 'fakta laut dalam', targetSec: 45 })
  assert.equal(hookEnabled(on), true)
  assert.equal(hookEnabled({ hook: true, targetSec: 15 }), false, 'terlalu pendek untuk hook')
  assert.equal(hookEnabled({ hook: false, targetSec: 60 }), false)
  const withHook = buildScriptPrompt(on)
  assert.match(withHook.user, /"hook": string/)
  assert.match(withHook.user, /sudah termasuk hook/)
  assert.match(withHook.system, /hook.*terpisah/)
  const without = buildScriptPrompt(validateOptions({ topic: 'fakta laut dalam', hook: false }))
  assert.doesNotMatch(without.user, /"hook"/)

  const body = [
    { text: 'Laut dalam menyimpan tekanan air yang luar biasa besar.', keywords: ['deep ocean'] },
    { text: 'Tekanan itu bisa meremukkan kapal selam biasa.', keywords: ['submarine'] },
    { text: 'Makhluk di sana bercahaya sendiri untuk berburu.', keywords: ['jellyfish'] }
  ]
  const raw = (hook: unknown) => ({ title: 'Laut Dalam', hook, hookKeywords: ['deep ocean', 'dark water'], sentences: body })
  const ok = parseScript(raw('Kenapa kapal selam bisa remuk di laut dalam?'), { hook: true, language: 'id' })
  assert.equal(ok.hook, 'Kenapa kapal selam bisa remuk di laut dalam?')
  assert.deepEqual(ok.hookKeywords, ['deep ocean', 'dark water'])
  assert.equal(ok.hookIssue, null)
  // Tanpa opsi hook: hook dari AI diabaikan.
  assert.equal(parseScript(raw('Kenapa kapal selam bisa remuk di laut dalam?')).hook, null)
  assert.match(parseScript(raw(''), { hook: true }).hookIssue ?? '', /tidak menulis hook/)
  assert.match(parseScript(raw('kata '.repeat(25)), { hook: true }).hookIssue ?? '', /terlalu panjang/)
  assert.match(parseScript(raw(body[0].text), { hook: true }).hookIssue ?? '', /sama dengan kalimat pertama/)
  assert.match(parseScript(raw('Bagaimana gunung berapi meletus kemarin sore?'), { hook: true, language: 'id' }).hookIssue ?? '', /tidak berkaitan/)
  // Bahasa tanpa spasi tidak diperiksa kesamaannya.
  assert.equal(parseScript(raw('深海の圧力はなぜ恐ろしいのか'), { hook: true, language: 'ja' }).hookIssue, null)
  // Hook ikut dihitung panjang naskah.
  const opt = { language: 'id', targetSec: 45 } as const
  const size = Math.floor(targetLength(opt).amount * 1.4) - 2
  const script = { ...ok, sentences: [{ text: Array.from({ length: size }, () => 'kata').join(' '), keywords: ['a'] }] }
  assert.equal(scriptLengthWarning({ ...script, hook: null }, opt), null)
  assert.match(scriptLengthWarning(script, opt) ?? '', /panjang/)
})
