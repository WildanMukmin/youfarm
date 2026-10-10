import { Check } from 'lucide-react'
import { ASPECT_INFO, ASPECT_RATIOS, type AspectRatio } from '@shared/contracts/modes'

interface Props {
  value: AspectRatio[]
  onChange: (next: AspectRatio[]) => void
}

/** Kotak tempat bingkai contoh digambar; bingkai diskalakan muat di dalamnya sesuai perbandingan format sebenarnya. */
const GLYPH_BOX = { w: 58, h: 46 }

/** Pilih satu atau beberapa format ekspor. Tiap kartu menggambar bingkai sebanding format aslinya. Minimal satu harus tetap terpilih. */
export default function AspectPicker({ value, onChange }: Props) {
  const toggle = (a: AspectRatio): void => {
    if (!value.includes(a)) return onChange(ASPECT_RATIOS.filter((x) => x === a || value.includes(x)))
    if (value.length > 1) onChange(value.filter((x) => x !== a))
  }

  return (
    <div className="grid gap-1.5">
      <span id="aspect-label" className="text-xs text-ink-muted">
        Format video
      </span>
      <div role="group" aria-labelledby="aspect-label" className="grid grid-cols-3 gap-2">
        {ASPECT_RATIOS.map((a) => {
          const { label, width, height } = ASPECT_INFO[a]
          const on = value.includes(a)
          const scale = Math.min(GLYPH_BOX.w / width, GLYPH_BOX.h / height)
          const [name, ratio] = label.split(' · ')
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(a)}
              className={`group relative grid min-w-0 justify-items-center gap-2 rounded-sm border px-2 pb-2 pt-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 ${
                on ? 'border-crimson bg-crimson/10' : 'border-line-hi hover:border-ink-muted'
              }`}
            >
              <span aria-hidden className="grid place-items-center" style={{ width: GLYPH_BOX.w, height: GLYPH_BOX.h }}>
              <span
                className={`block rounded-[3px] border-2 ${on ? 'border-crimson bg-crimson/25' : 'border-line-hi bg-bg group-hover:border-ink-muted'}`}
                style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}
              />
              </span>
              <span className="grid gap-0.5">
                <span className={`text-xs font-semibold ${on ? 'text-ink' : 'text-ink-muted'}`}>{name}</span>
                <span className="font-mono text-[10px] text-ink-muted">{ratio ?? a}</span>
              </span>
              {on && <Check size={12} strokeWidth={3} aria-hidden className="absolute right-1.5 top-1.5 text-crimson-hi" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
