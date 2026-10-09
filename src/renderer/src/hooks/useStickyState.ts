import { useCallback, useState } from 'react'

// Disimpan di memori modul: isian form tidak hilang saat pindah menu, tetapi kembali bersih saat aplikasi ditutup.
const store = new Map<string, unknown>()

/** Seperti useState, tetapi nilainya bertahan walau komponen dilepas lalu dipasang lagi. */
export function useStickyState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial))
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        store.set(key, v)
        return v
      })
    },
    [key]
  )
  return [value, set]
}
