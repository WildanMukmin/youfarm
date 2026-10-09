import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CAPTION_REF_HEIGHT, CAPTION_SIDE_MARGIN, chunkWords, timeWords, type CaptionStyle } from '@shared/captions'
import { languageInfo, splitWords, wordJoiner } from '@shared/languages'
import { useElementSize } from '@/hooks/useFitRows'

/** Contoh kalimat per bahasa; bahasa lain memakai contoh bahasa Inggris. */
const SAMPLE: Record<string, string> = {
  id: 'Laut dalam masih menyimpan banyak rahasia yang belum terungkap.',
  en: 'The deep ocean still hides secrets nobody has uncovered.',
  ms: 'Lautan dalam masih menyimpan banyak rahsia yang belum terbongkar.',
  es: 'El océano profundo todavía guarda secretos sin descubrir.',
  pt: 'O oceano profundo ainda guarda segredos não descobertos.',
  ja: '深海には、まだ誰も知らない秘密がたくさん眠っています。',
  ko: '깊은 바다에는 아직 밝혀지지 않은 비밀이 많습니다.',
  zh: '深海里仍然藏着许多无人知晓的秘密。',
  ar: 'ما زال المحيط العميق يخفي أسرارًا لم يكتشفها أحد.',
  hi: 'गहरा समुद्र अब भी कई अनसुलझे रहस्य छिपाए हुए है।',
  th: 'ทะเลลึกยังซ่อนความลับมากมายที่ไม่มีใครรู้'
}

const hexA = (hex: string, opacity: number): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity / 100})`
}

const STEP_MS = 380

interface Props {
  style: CaptionStyle
  language: string
}

/**
 * Pratinjau caption di bingkai 9:16, memakai ukuran, margin, dan titik jangkar yang sama dengan berkas ASS
 * (diskalakan dari frame 1080x1920). Diam di kata kedua; tombol Putar menjalankan satu putaran animasinya.
 */
export default function CaptionPreview({ style, language }: Props) {
  const frame = useElementSize()
  const [step, setStep] = useState<number | null>(null)
  const timer = useRef<number | null>(null)

  const chunks = useMemo(() => {
    const text = SAMPLE[language] ?? SAMPLE.en
    const words = timeWords(splitWords(text, language), 0, 1)
    return chunkWords(words, style.wordsPerChunk, languageInfo(language).unit === 'char' ? style.wordsPerChunk * 4 : undefined)
  }, [language, style.wordsPerChunk])

  // Urutan kata sepanjang satu putaran: [indeks potongan, indeks kata].
  const sequence = useMemo(() => chunks.flatMap((c, ci) => c.words.map((_, wi) => [ci, wi] as const)), [chunks])

  useEffect(() => () => void (timer.current && window.clearInterval(timer.current)), [])

  const play = (): void => {
    if (timer.current) window.clearInterval(timer.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setStep(0)
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s === null || s + 1 >= sequence.length) {
          if (timer.current) window.clearInterval(timer.current)
          timer.current = null
          return null
        }
        return s + 1
      })
    }, STEP_MS)
  }

  const [chunkIndex, wordIndex] = step === null ? [0, Math.min(1, (chunks[0]?.words.length ?? 1) - 1)] : sequence[step]
  const chunk = chunks[chunkIndex]
  const k = frame.height / CAPTION_REF_HEIGHT
  const join = wordJoiner(language)
  const boxPad = Math.max(10, Math.round(style.size * 0.18)) * k

  const textStyle: CSSProperties = {
    fontFamily: `'${style.font}', 'Segoe UI', sans-serif`,
    fontSize: style.size * k,
    fontWeight: style.bold ? 700 : 400,
    lineHeight: 1.18,
    color: style.color,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    textAlign: style.align,
    ...(style.box
      ? {}
      : {
          WebkitTextStroke: style.outline ? `${style.outline * 2 * k}px ${style.outlineColor}` : undefined,
          paintOrder: 'stroke fill'
        }),
    textShadow: style.shadow ? `${style.shadow * k}px ${style.shadow * k}px 0 rgba(0,0,0,0.55)` : undefined
  }

  const animated = step !== null
  const wordAt = (text: string, i: number) => {
    const active = i === wordIndex && (style.highlight || style.animation === 'word-zoom')
    return (
      <span
        key={i}
        className="inline-block transition-transform duration-100"
        style={{
          color: active && style.highlight ? style.highlightColor : undefined,
          transform: active && style.animation === 'word-zoom' && animated ? 'scale(1.18)' : undefined
        }}
      >
        {text}
        {join && i < (chunk?.words.length ?? 0) - 1 ? ' ' : ''}
      </span>
    )
  }

  return (
    <div ref={frame.ref} className="relative h-full w-full overflow-hidden bg-[linear-gradient(160deg,#2b3a4a,#11161c_70%)]" aria-label="Pratinjau caption">
      {chunk && (
        <div
          className="absolute"
          style={{ left: `${CAPTION_SIDE_MARGIN}%`, right: `${CAPTION_SIDE_MARGIN}%`, top: `${style.positionY}%`, transform: 'translateY(-50%)', ...textStyle }}
        >
          <span
            key={animated ? chunkIndex : 'diam'}
            className={animated && style.animation === 'pop' ? 'caption-pop' : animated && style.animation === 'fade' ? 'caption-fade' : undefined}
            style={
              style.box
                ? { background: hexA(style.boxColor, style.boxOpacity), padding: `${boxPad * 0.6}px ${boxPad}px`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }
                : undefined
            }
          >
            {chunk.words.map((w, i) => wordAt(w.text, i))}
          </span>
        </div>
      )}
      {/* Di bingkai yang sangat kecil tombol akan menutupi caption; pratinjau diam tetap tampil. */}
      {frame.width >= 150 && (
        <button
          type="button"
          onClick={play}
          className="absolute bottom-3 right-3 rounded-sm border border-line-hi bg-bg/80 px-2.5 py-1 text-xs text-ink hover:border-crimson"
        >
          {animated ? 'Memutar…' : 'Putar'}
        </button>
      )}
    </div>
  )
}
