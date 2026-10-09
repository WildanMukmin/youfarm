import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assColor, buildChunks, toAss, toSrt } from '../../src/main/modes/fakta-unik/captions.ts'
import { DEFAULT_CAPTION } from '../../src/shared/captions.ts'
import { buildRenderArgs, segmentDurations } from '../../src/main/modes/fakta-unik/render.ts'
import { createFfmpeg } from '../../src/main/platform/ffmpeg.ts'
import { spawnProcess } from '../../src/main/platform/spawn-process.ts'

const ROOT = join(import.meta.dirname, '../..')
const BIN = join(ROOT, 'binaries/win-x64')
const FONT = join(ROOT, 'assets/fonts/caption/Poppins-Bold.ttf')
const skip = existsSync(join(BIN, 'ffmpeg.exe')) ? false : 'ffmpeg belum terpasang (npm run setup:ffmpeg)'

test('buildChunks: potongan per kalimat, maks N kata, dipotong di tanda baca, waktu kata berurutan', () => {
  const chunks = buildChunks(
    [
      { text: 'Laut dalam menyimpan rahasia, yang belum terungkap.', start: 0, speechSec: 3 },
      { text: 'Tujuh delapan.', start: 3.5, speechSec: 1 }
    ],
    'id',
    3
  )
  assert.deepEqual(chunks.map((c) => c.words.map((w) => w.text).join(' ')), ['Laut dalam menyimpan', 'rahasia,', 'yang belum terungkap.', 'Tujuh delapan.'])
  const words = chunks.flatMap((c) => c.words)
  assert.equal(words[0].start, 0)
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].end - 1e-9)
  assert.ok(Math.abs(chunks[2].end - 3) < 1e-9, 'kalimat pertama berakhir tepat di akhir ucapannya')
  assert.ok(Math.abs(chunks.at(-1)!.end - 4.5) < 1e-9)
  // Kata lebih panjang mendapat waktu lebih lama.
  assert.ok(words[2].end - words[2].start > words[0].end - words[0].start)

  // Bahasa tanpa spasi: dipenggal per kata dan dibatasi jumlah karakter.
  const ja = buildChunks([{ text: '深海には、まだ誰も知らない秘密がたくさん眠っています。', start: 0, speechSec: 4 }], 'ja', 3)
  assert.ok(ja.length >= 3)
  assert.ok(ja.every((c) => c.words.map((w) => w.text).join('').length <= 13))
  assert.equal(ja.map((c) => c.words.map((w) => w.text).join('')).join(''), '深海には、まだ誰も知らない秘密がたくさん眠っています。')
})

test('toAss dan toSrt: format waktu, gaya, sorot kata aktif, dan perataan', () => {
  const chunks = [{ start: 3661.5, end: 3662.5, words: [{ text: 'Halo', start: 3661.5, end: 3662 }, { text: '{dunia}', start: 3662, end: 3662.5 }] }]
  const ass = toAss(chunks, { ...DEFAULT_CAPTION, animation: 'none' }, 'id')
  const events = (a: string): string[] => a.split('\n').filter((l) => l.startsWith('Dialogue'))
  assert.match(ass, /PlayResX: 1080/)
  assert.match(ass, /Style: Caption,Poppins,92,&H00FFFFFF,/)
  // Satu event per kata: kata aktif berwarna sorot (#FFD400 = &H00D4FF), lalu kembali putih.
  const [first, second] = events(ass)
  assert.ok(first.startsWith('Dialogue: 0,1:01:01.50,1:01:02.00,Caption,,76,76,0,,{\\an5\\pos(540,1306)}'), first)
  assert.ok(first.endsWith('{\\1c&H00D4FF&}HALO{\\1c&HFFFFFF&} DUNIA'), first)
  assert.ok(second.startsWith('Dialogue: 0,1:01:02.00,1:01:02.50,'), second)
  assert.ok(second.endsWith('HALO {\\1c&H00D4FF&}DUNIA{\\1c&HFFFFFF&}'), second)

  // Tanpa sorot: satu event per potongan, teks asli (tanpa kapital), animasi pop di awal, rata kiri.
  const plain = events(toAss(chunks, { ...DEFAULT_CAPTION, highlight: false, uppercase: false, animation: 'pop', align: 'left' }, 'id'))
  assert.equal(plain.length, 1)
  assert.ok(plain[0].includes('{\\an4\\pos(76,1306)}{\\fscx80'), plain[0])
  assert.ok(plain[0].endsWith('}Halo dunia'), plain[0])

  // Kotak latar: BorderStyle 3 dengan warna kotak sebagai OutlineColour (60% = alpha 66).
  assert.match(toAss(chunks, { ...DEFAULT_CAPTION, box: true, boxColor: '#C0102A', boxOpacity: 60 }, 'id'), /,&H662A10C0,&H[0-9A-F]{8},-1,0,0,0,100,100,0,0,3,/)
  assert.equal(assColor('#112233', 100), '&H00332211')

  assert.ok(toSrt(chunks, 'id').startsWith('1\n01:01:01,500 --> 01:01:02,500\nHalo {dunia}\n'))
  assert.match(toSrt([{ start: 0, end: 1, words: [{ text: '深海', start: 0, end: 0.5 }, { text: 'には', start: 0.5, end: 1 }] }], 'ja'), /深海には/)
})

test('buildRenderArgs: struktur filter dan pemetaan', () => {
  const args = buildRenderArgs({
    segments: [{ path: 'a.mp4', duration: 2 }, { path: 'b.mp4', duration: 1.5 }],
    narrationPath: 'n.wav',
    assFile: 'c.ass',
    fontsDir: 'fonts',
    output: 'out.mp4',
    bitrateKbps: 8000
  })
  const fc = args[args.indexOf('-filter_complex') + 1]
  assert.match(fc, /concat=n=2:v=1:a=0\[vcat\]/)
  assert.match(fc, /ass=c\.ass:fontsdir=fonts\[vout\]/)
  assert.equal(args[args.indexOf('-map', args.indexOf('[vout]')) + 1], '2:a')
  assert.equal(args.at(-1), 'out.mp4')
  assert.throws(() => buildRenderArgs({ segments: [], narrationPath: '', assFile: '', fontsDir: '', output: '', bitrateKbps: 1 }), /Tidak ada segmen/)
  assert.deepEqual(segmentDurations([1, 2], 0.25), [1.25, 2.25])
})

test('render nyata: 3 footage landscape jadi 1080x1920 dengan caption terbakar dan narasi', { skip }, async () => {
  const ff = createFfmpeg(BIN)
  const work = mkdtempSync(join(tmpdir(), 'yf-render-'))
  mkdirSync(join(work, 'fonts'))
  copyFileSync(FONT, join(work, 'fonts', 'Poppins-Bold.ttf'))

  // Footage palsu dengan ukuran dan lama berbeda (satu lebih pendek dari segmennya, harus diulang).
  const clips: string[] = []
  const specs = [['640x360', 3], ['480x480', 1], ['1280x720', 2]] as const
  for (let i = 0; i < specs.length; i++) {
    const p = join(work, `clip${i}.mp4`)
    await ff.run(['-f', 'lavfi', '-i', `testsrc2=size=${specs[i][0]}:rate=25:duration=${specs[i][1]}`, '-pix_fmt', 'yuv420p', p])
    clips.push(p)
  }
  const narration = join(work, 'n.wav')
  await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=6', narration])

  const durations = [2.5, 2, 1.5]
  const chunks = buildChunks(
    [
      { text: 'Ini kalimat pertama yang cukup panjang.', start: 0, speechSec: 2.3 },
      { text: 'Kalimat kedua.', start: 2.5, speechSec: 1.8 },
      { text: 'Penutup.', start: 4.5, speechSec: 1.3 }
    ],
    'id',
    3
  )
  writeFileSync(join(work, 'c.ass'), toAss(chunks, DEFAULT_CAPTION, 'id'))

  const out = join(work, 'out.mp4')
  const args = buildRenderArgs({
    segments: clips.map((path, i) => ({ path, duration: durations[i] })),
    narrationPath: narration,
    assFile: 'c.ass',
    fontsDir: 'fonts',
    output: out,
    bitrateKbps: 4000
  })
  const r = await spawnProcess(join(BIN, 'ffmpeg.exe'), ['-hide_banner', '-nostdin', '-y', ...args], { cwd: work })
  assert.equal(r.code, 0, r.stderrTail)

  assert.deepEqual(await ff.size(out), { width: 1080, height: 1920 })
  const dur = await ff.duration(out)
  assert.ok(Math.abs(dur - 6) < 0.3, `durasi ${dur}`)

  // Caption benar-benar terbakar: bandingkan frame dengan dan tanpa caption di area caption.
  const crop = async (name: string, ass: string): Promise<Buffer> => {
    const o = join(work, name)
    writeFileSync(join(work, `${name}.ass`), ass)
    const a = buildRenderArgs({ segments: [{ path: clips[0], duration: 1 }], narrationPath: narration, assFile: `${name}.ass`, fontsDir: 'fonts', output: join(work, `${name}.mp4`), bitrateKbps: 4000 })
    const rr = await spawnProcess(join(BIN, 'ffmpeg.exe'), ['-hide_banner', '-nostdin', '-y', ...a], { cwd: work })
    assert.equal(rr.code, 0, rr.stderrTail)
    await ff.run(['-i', join(work, `${name}.mp4`), '-ss', '0.5', '-frames:v', '1', '-vf', 'crop=1080:300:0:1000', o + '.png'])
    return readFileSync(o + '.png')
  }
  const one = [{ start: 0, end: 1, words: [{ text: 'CAPTION', start: 0, end: 0.5 }, { text: 'UJI', start: 0.5, end: 1 }] }]
  const withCap = await crop('cap', toAss(one, { ...DEFAULT_CAPTION, positionY: 60 }, 'id'))
  const noCap = await crop('nocap', toAss([], DEFAULT_CAPTION, 'id'))
  assert.notDeepEqual(withCap, noCap)
})
