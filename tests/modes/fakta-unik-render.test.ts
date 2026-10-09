import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCues, splitCaptionChunks, toAss, toSrt } from '../../src/main/modes/fakta-unik/captions.ts'
import { buildRenderArgs, segmentDurations } from '../../src/main/modes/fakta-unik/render.ts'
import { createFfmpeg } from '../../src/main/platform/ffmpeg.ts'
import { spawnProcess } from '../../src/main/platform/spawn-process.ts'

const ROOT = join(import.meta.dirname, '../..')
const BIN = join(ROOT, 'binaries/win-x64')
const FONT = join(ROOT, 'assets/fonts/caption/Poppins-Bold.ttf')
const skip = existsSync(join(BIN, 'ffmpeg.exe')) ? false : 'ffmpeg belum terpasang (npm run setup:ffmpeg)'

test('splitCaptionChunks: maks 3 kata, dipotong di tanda baca', () => {
  assert.deepEqual(splitCaptionChunks('Laut dalam menyimpan rahasia yang belum terungkap.'), ['Laut dalam menyimpan', 'rahasia yang belum', 'terungkap.'])
  assert.deepEqual(splitCaptionChunks('Halo, dunia yang indah'), ['Halo,', 'dunia yang indah'])
  assert.deepEqual(splitCaptionChunks('  '), [])
  assert.ok(splitCaptionChunks('internasionalisasi kelembagaan pemerintahan daerah').every((c) => c.length <= 40))
})

test('buildCues: potongan berurutan, menutup rentang ucapan, tanpa tumpang tindih', () => {
  const cues = buildCues([
    { text: 'Satu dua tiga empat lima enam.', start: 0, speechSec: 3 },
    { text: 'Tujuh delapan.', start: 3.5, speechSec: 1 }
  ])
  assert.equal(cues[0].start, 0)
  assert.ok(Math.abs(cues[1].end - 3) < 1e-9 || cues.some((c) => Math.abs(c.end - 3) < 1e-9))
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9)
  assert.ok(Math.abs(cues.at(-1)!.end - 4.5) < 1e-9)
})

test('toAss dan toSrt: format waktu dan gaya', () => {
  const cues = [{ start: 3661.5, end: 3662, text: 'Halo {dunia}' }]
  const ass = toAss(cues, 'kuning-tebal')
  assert.match(ass, /Dialogue: 0,1:01:01\.50,1:01:02\.00,Default,,0,0,0,,HALO DUNIA/)
  assert.match(ass, /PlayResX: 1080/)
  assert.match(toAss(cues, 'kotak-gelap'), /,3,14,2,2,/)
  assert.match(toSrt(cues), /^1\n01:01:01,500 --> 01:01:02,000\nHalo \{dunia\}\n/)
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
  const cues = buildCues([
    { text: 'Ini kalimat pertama yang cukup panjang.', start: 0, speechSec: 2.3 },
    { text: 'Kalimat kedua.', start: 2.5, speechSec: 1.8 },
    { text: 'Penutup.', start: 4.5, speechSec: 1.3 }
  ])
  writeFileSync(join(work, 'c.ass'), toAss(cues, 'kuning-tebal'))

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
  const withCap = await crop('cap', toAss([{ start: 0, end: 1, text: 'CAPTION UJI' }], 'kuning-tebal'))
  const noCap = await crop('nocap', toAss([], 'kuning-tebal'))
  assert.notDeepEqual(withCap, noCap)
})
