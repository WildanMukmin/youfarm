import { useEffect, useState, type ReactNode } from 'react'
import Button from './Button'

interface Props {
  children: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  disabled?: boolean
  size?: 'md' | 'sm'
}

/** Tombol aksi berisiko: klik pertama meminta konfirmasi, klik kedua menjalankan. Batal sendiri setelah 4 detik. */
export default function ConfirmButton({ children, confirmLabel = 'Yakin?', onConfirm, disabled, size }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <Button
      variant="ghost"
      size={size}
      disabled={disabled}
      className={armed ? '!border-err !text-err' : ''}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}
