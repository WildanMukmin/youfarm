import { useId, useState } from 'react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { TopicSuggestion } from '@shared/modes/fakta-unik'
import { useStickyState } from '@/hooks/useStickyState'
import { errMsg } from '@/lib/errors'

interface Props {
  mode: string
  language: string
  /** Penulis teks yang dipilih di form mode. */
  textProvider: string
  textModel: string
  /** Isi kolom: satu topik per baris. */
  value: string
  onChange: (next: string) => void
  /** Jumlah topik yang terbaca, untuk keterangan di footer kolom. */
  count: number
  /** Alasan AI belum bisa dipakai (key atau model penulis teks belum diisi). */
  disabledReason: string | null
  /** Pesan di bawah kolom (kesalahan isian atau catatan jumlah video). */
  hint?: string
  invalid?: boolean
}

const splitLines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean)

/**
 * Satu kolom untuk topik: ketik sendiri, atau minta AI memilihkan. Isi kolom dipakai sebagai niche bila ada
 * (kosong = niche campuran); saran tampil di bawah dan sekali klik masuk ke kolom. Bila niche yang diketik
 * dipakai sebagai bahan saran, memilih saran menggantikannya supaya kolom hanya berisi topik jadi.
 */
export default function TopicComposer({ mode, language, textProvider, textModel, value, onChange, count, disabledReason, hint, invalid }: Props) {
  const id = useId()
  const hintId = useId()
  const [items, setItems] = useStickyState<TopicSuggestion[]>(`${mode}:suggestions`, [])
  const [seed, setSeed] = useStickyState<string | null>(`${mode}:suggest-seed`, null)
  const [loading, setLoading] = useState(false)

  const lines = splitLines(value)
  const have = new Set(lines.map((t) => t.toLowerCase()))
  const fresh = items.filter((i) => !have.has(i.topic.toLowerCase()))
  const blocked = loading || Boolean(disabledReason)
  // Niche = isi kolom bila hanya satu baris; beberapa baris berarti topik sudah jadi, jadi AI memilih bebas.
  const niche = lines.length === 1 ? lines[0] : ''

  const ask = async (): Promise<void> => {
    setLoading(true)
    try {
      setItems(await window.youfarm.modes.suggestTopics({ mode, seed: niche, language, textProvider, textModel }))
      setSeed(niche || null)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal meminta saran topik.'))
    } finally {
      setLoading(false)
    }
  }

  const add = (topics: string[]): void => {
    // Niche yang jadi bahan saran digantikan oleh topik yang dipilih.
    const keep = lines.length === 1 && seed !== null && lines[0] === seed ? [] : lines
    const taken = new Set(keep.map((t) => t.toLowerCase()))
    onChange([...keep, ...topics.filter((t) => !taken.has(t.toLowerCase()))].join('\n'))
    if (keep.length === 0) setSeed(null)
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-xs text-ink-muted">
        Topik
      </label>
      <div
        className={`min-w-0 overflow-hidden rounded-sm border bg-bg focus-within:ring-2 ${
          invalid ? 'border-err focus-within:ring-err/20' : 'border-line-hi focus-within:border-crimson focus-within:ring-crimson/20'
        }`}
      >
        <textarea
          id={id}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          rows={3}
          maxLength={8000}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'Tulis topik, mis. fakta aneh laut dalam.\nSatu topik per baris untuk banyak video.\nAtau kosongkan dan klik "Pilihkan AI".'}
          className="block min-h-[76px] w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 border-t border-line bg-panel-2/50 px-2 py-1.5">
          <span className="tabular truncate font-mono text-[11px] text-ink-muted">{count > 1 ? `${count} topik` : lines.length === 1 ? 'Jadi niche untuk AI' : ''}</span>
          <button
            type="button"
            disabled={blocked}
            title={disabledReason ?? (niche ? `Minta AI memilihkan topik di niche "${niche}"` : 'Minta AI memilihkan topik')}
            onClick={() => void ask()}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm border border-line-hi px-2.5 text-xs font-semibold text-ink-muted transition-colors hover:border-crimson hover:text-crimson-hi disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={12} aria-hidden className={loading ? 'animate-pulse' : undefined} />
            {loading ? 'Memilih…' : items.length ? 'Pilihkan lagi' : 'Pilihkan AI'}
          </button>
        </div>
        {items.length > 0 && (
          <ul className="grid gap-px border-t border-line bg-line" aria-label="Saran topik dari AI">
            {items.map((s) => {
              const added = have.has(s.topic.toLowerCase())
              return (
                <li key={s.topic} className="bg-bg">
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => add([s.topic])}
                    className="group flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-panel-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-bg"
                  >
                    {added ? <Check size={13} className="mt-0.5 shrink-0 text-ok" aria-label="Sudah ditambahkan" /> : <Plus size={13} className="mt-0.5 shrink-0 text-ink-muted group-hover:text-crimson-hi" aria-hidden />}
                    <span className="min-w-0">
                      <span className="block text-ink">{s.topic}</span>
                      {s.why && <span className="block text-ink-muted">{s.why}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
            {fresh.length > 1 && (
              <li className="bg-bg px-3 py-1.5">
                <button type="button" onClick={() => add(fresh.map((s) => s.topic))} className="text-xs text-crimson-hi underline underline-offset-2">
                  Tambahkan {fresh.length} topik sekaligus
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      {disabledReason && <p className="text-[11px] text-ink-muted">{disabledReason}</p>}
      {hint && (
        <p id={hintId} className={`text-[11px] ${invalid ? 'text-err' : 'text-ink-muted'}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
