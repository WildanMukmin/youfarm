import type { ReactNode } from 'react'
import {
  CAPTION_ANIMATIONS,
  CAPTION_ANIMATION_LABEL,
  CAPTION_FONTS,
  CAPTION_TEMPLATES,
  LIMITS,
  templateOf,
  type CaptionAlign,
  type CaptionStyle
} from '@shared/captions'
import Checkbox from '@/ui/Checkbox'
import ColorField from '@/ui/ColorField'
import RangeField from '@/ui/RangeField'
import Segmented from '@/ui/Segmented'
import Select from '@/ui/Select'

interface Props {
  value: CaptionStyle
  onChange: (next: CaptionStyle) => void
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
      <h3 className="text-[11px] font-medium text-ink-muted">{title}</h3>
      {children}
    </section>
  )
}

const px = (v: number): string => `${v} px`

/** Pengaturan caption lengkap. Template mengisi semua kolom sekaligus; tiap kolom tetap bisa diubah sesudahnya. */
export default function CaptionEditor({ value, onChange }: Props) {
  const set = <K extends keyof CaptionStyle>(k: K, v: CaptionStyle[K]) => onChange({ ...value, [k]: v })
  const active = templateOf(value)

  return (
    <div className="grid gap-4">
      <Group title="Template">
        <div role="group" aria-label="Template caption" className="grid grid-cols-2 gap-1.5">
          {CAPTION_TEMPLATES.map((t) => {
            const on = active?.id === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(t.style)}
                className={`truncate rounded-sm border px-2 py-1.5 text-left text-xs transition-colors ${on ? 'border-crimson bg-crimson/15 text-ink' : 'border-line-hi text-ink-muted hover:border-ink-muted hover:text-ink'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        {!active && <p className="text-[11px] text-ink-muted">Gaya sendiri. Pilih template untuk mulai dari awal.</p>}
      </Group>

      <Group title="Teks">
        <Select label="Font" value={value.font} onChange={(e) => set('font', e.target.value)}>
          <optgroup label="Dibundel aplikasi">
            {CAPTION_FONTS.filter((f) => f.bundled).map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </optgroup>
          <optgroup label="Font Windows">
            {CAPTION_FONTS.filter((f) => !f.bundled).map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </optgroup>
        </Select>
        <RangeField label="Ukuran" value={value.size} min={LIMITS.size[0]} max={LIMITS.size[1]} format={px} onChange={(v) => set('size', v)} />
        <Segmented
          label="Kata per tampilan"
          value={String(value.wordsPerChunk)}
          onChange={(v) => set('wordsPerChunk', Number(v))}
          options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: n }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Checkbox label="Tebal" checked={value.bold} onChange={(e) => set('bold', e.target.checked)} />
          <Checkbox label="Huruf kapital" checked={value.uppercase} onChange={(e) => set('uppercase', e.target.checked)} />
        </div>
      </Group>

      <Group title="Warna">
        <ColorField label="Warna teks" value={value.color} onChange={(v) => set('color', v)} />
        <Checkbox label="Sorot kata yang sedang diucapkan" checked={value.highlight} onChange={(e) => set('highlight', e.target.checked)} />
        {value.highlight && <ColorField label="Warna sorot" value={value.highlightColor} onChange={(v) => set('highlightColor', v)} />}
      </Group>

      <Group title="Latar dan garis tepi">
        <Segmented
          label="Gaya latar"
          value={value.box ? 'box' : 'outline'}
          onChange={(v) => set('box', v === 'box')}
          options={[
            { value: 'outline', label: 'Garis tepi' },
            { value: 'box', label: 'Kotak' }
          ]}
        />
        {value.box ? (
          <>
            <ColorField label="Warna kotak" value={value.boxColor} onChange={(v) => set('boxColor', v)} />
            <RangeField label="Kepekatan kotak" value={value.boxOpacity} min={LIMITS.boxOpacity[0]} max={LIMITS.boxOpacity[1]} step={5} format={(v) => `${v}%`} onChange={(v) => set('boxOpacity', v)} />
          </>
        ) : (
          <>
            <RangeField label="Tebal garis tepi" value={value.outline} min={LIMITS.outline[0]} max={LIMITS.outline[1]} format={px} onChange={(v) => set('outline', v)} />
            {value.outline > 0 && <ColorField label="Warna garis tepi" value={value.outlineColor} onChange={(v) => set('outlineColor', v)} />}
          </>
        )}
        <RangeField label="Bayangan" value={value.shadow} min={LIMITS.shadow[0]} max={LIMITS.shadow[1]} format={px} onChange={(v) => set('shadow', v)} />
      </Group>

      <Group title="Animasi dan posisi">
        <Select label="Animasi" value={value.animation} onChange={(e) => set('animation', e.target.value as CaptionStyle['animation'])}>
          {CAPTION_ANIMATIONS.map((a) => (
            <option key={a} value={a}>
              {CAPTION_ANIMATION_LABEL[a]}
            </option>
          ))}
        </Select>
        <RangeField label="Posisi tegak (dari atas)" value={value.positionY} min={LIMITS.positionY[0]} max={LIMITS.positionY[1]} format={(v) => `${v}%`} onChange={(v) => set('positionY', v)} />
        <Segmented<CaptionAlign>
          label="Rata teks"
          value={value.align}
          onChange={(v) => set('align', v)}
          options={[
            { value: 'left', label: 'Kiri' },
            { value: 'center', label: 'Tengah' },
            { value: 'right', label: 'Kanan' }
          ]}
        />
      </Group>
    </div>
  )
}
