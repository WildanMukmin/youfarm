import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export interface IconConfirm {
  /** Pertanyaan yang tampil di kartu konfirmasi, mis. "Hapus video dan berkasnya dari komputer?". */
  message: string
  /** Teks tombol yang menjalankan aksi. */
  action: string
}

interface Props {
  icon: LucideIcon
  /** Label untuk pembaca layar dan tooltip. */
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'primary'
  /** Bila diisi, klik membuka kartu konfirmasi di dekat tombol. Aksi baru jalan setelah dikonfirmasi. */
  confirm?: IconConfirm
}

/** Pengisi selebar satu tombol ikon, supaya tombol di tiap baris tabel tetap sejajar walau ada yang tidak tampil. */
export function IconGap() {
  return <span aria-hidden className="inline-block h-8 w-8 shrink-0" />
}

const CARD_WIDTH = 260
const CARD_GAP = 6
const MARGIN = 8

/** Kartu konfirmasi: ditempel di bawah tombol (atau di atasnya bila tidak muat), rata kanan, tanpa menggeser tombol lain. */
function ConfirmCard({ anchor, confirm, onCancel, onConfirm }: { anchor: HTMLElement; confirm: IconConfirm; onCancel: () => void; onConfirm: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const place = (): void => {
      const a = anchor.getBoundingClientRect()
      const h = card.current?.offsetHeight ?? 110
      const below = a.bottom + CARD_GAP + h <= window.innerHeight - MARGIN
      const left = Math.min(Math.max(MARGIN, a.right - CARD_WIDTH), window.innerWidth - CARD_WIDTH - MARGIN)
      setPos({ top: below ? a.bottom + CARD_GAP : Math.max(MARGIN, a.top - CARD_GAP - h), left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onCancel, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onCancel, true)
    }
  }, [anchor, onCancel])

  useEffect(() => {
    cancel.current?.focus()
    const onDown = (e: MouseEvent): void => {
      if (!card.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onCancel()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel()
        anchor.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onCancel])

  return createPortal(
    <div
      ref={card}
      role="alertdialog"
      aria-labelledby={id}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: CARD_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
      className="z-50 grid gap-3 rounded-md border border-line-hi bg-panel p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      <p id={id} className="text-sm leading-snug text-ink">
        {confirm.message}
      </p>
      <div className="flex justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          onClick={onCancel}
          className="h-8 rounded-sm border border-line-hi px-3 text-xs font-semibold text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-8 rounded-sm border border-err bg-err/15 px-3 text-xs font-semibold text-err transition-colors hover:bg-err hover:text-white"
        >
          {confirm.action}
        </button>
      </div>
    </div>,
    document.body
  )
}

/** Tombol ikon ringkas untuk baris tabel. */
export default function IconButton({ icon: Icon, label, onClick, disabled, tone = 'default', confirm }: Props) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const close = useRef(() => setOpen(false)).current

  const base = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const look = open
    ? 'border-err text-err'
    : tone === 'primary'
      ? 'border-transparent bg-crimson text-white hover:brightness-110'
      : 'border-line-hi text-ink-muted hover:border-crimson hover:text-crimson-hi'

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup={confirm ? 'dialog' : undefined}
        aria-expanded={confirm ? open : undefined}
        title={label}
        disabled={disabled}
        onClick={() => (confirm ? setOpen((o) => !o) : onClick())}
        className={`${base} ${look}`}
      >
        <Icon size={14} strokeWidth={2} aria-hidden />
      </button>
      {open && confirm && button.current && (
        <ConfirmCard
          anchor={button.current}
          confirm={confirm}
          onCancel={close}
          onConfirm={() => {
            setOpen(false)
            onClick()
          }}
        />
      )}
    </>
  )
}
