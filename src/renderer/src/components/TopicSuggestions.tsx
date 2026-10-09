import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { TopicSuggestion } from '@shared/modes/fakta-unik'
import { errMsg } from '@/lib/errors'
import { useStickyState } from '@/hooks/useStickyState'
import Button from '@/ui/Button'
import Field from '@/ui/Field'

interface Props {
  mode: string
  language: string
  /** Penulis teks yang dipilih di form mode. */
  textProvider: string
  textModel: string
  /** Topik yang sudah ada di kolom topik (untuk menandai saran yang sudah ditambahkan). */
  current: string[]
  /** Alasan tombol tidak bisa dipakai (key atau model penulis teks belum diisi). */
  disabledReason: string | null
  onAdd: (topics: string[]) => void
}

/** Minta AI (Gemini atau Groq sesuai pilihan di form mode) menyarankan topik, lalu tambahkan ke kolom topik. */
export default function TopicSuggestions({ mode, language, textProvider, textModel, current, disabledReason, onAdd }: Props) {
  const [items, setItems] = useStickyState<TopicSuggestion[]>(`${mode}:suggestions`, [])
  const [seed, setSeed] = useStickyState(`${mode}:suggest-niche`, '')
  const [loading, setLoading] = useState(false)
  const have = new Set(current.map((t) => t.toLowerCase()))
  const fresh = items.filter((i) => !have.has(i.topic.toLowerCase()))
  const blocked = loading || Boolean(disabledReason)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setItems(await window.youfarm.modes.suggestTopics({ mode, seed: seed.trim(), language, textProvider, textModel }))
    } catch (e) {
      toast.error(errMsg(e, 'Gagal meminta saran topik.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Saran topik dari AI"
            value={seed}
            maxLength={200}
            placeholder="Niche, mis. sejarah kuno (boleh kosong)"
            className="w-full"
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !blocked) void load()
            }}
          />
        </div>
        <Button variant="ghost" className="h-[42px] shrink-0" disabled={blocked} onClick={() => void load()}>
          {loading ? 'Meminta…' : items.length ? 'Lagi' : 'Sarankan'}
        </Button>
      </div>
      {disabledReason && <p className="text-[11px] text-ink-muted">{disabledReason}</p>}

      {items.length > 0 && (
        <ul className="grid gap-1" aria-label="Saran topik">
          {items.map((s) => {
            const added = have.has(s.topic.toLowerCase())
            return (
              <li key={s.topic}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAdd([s.topic])}
                  className="group flex w-full items-start gap-2 rounded-sm border border-line px-2.5 py-1.5 text-left text-xs transition-colors hover:border-line-hi disabled:cursor-default disabled:opacity-60"
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
        </ul>
      )}
      {fresh.length > 1 && (
        <button type="button" onClick={() => onAdd(fresh.map((s) => s.topic))} className="justify-self-start text-xs text-crimson-hi underline underline-offset-2">
          Tambahkan {fresh.length} topik sekaligus
        </button>
      )}
    </div>
  )
}
