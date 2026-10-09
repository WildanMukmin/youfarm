import { useCallback, useEffect, useState } from 'react'

/**
 * Ukuran elemen yang terus diperbarui saat jendela atau panel berubah. Memakai callback ref,
 * jadi tetap bekerja walau elemennya baru muncul belakangan (mis. setelah data dimuat).
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((el: T | null) => setNode(el), [])

  useEffect(() => {
    if (!node) return
    const update = (): void => setSize((s) => (s.width === node.clientWidth && s.height === node.clientHeight ? s : { width: node.clientWidth, height: node.clientHeight }))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return { ref, ...size }
}

/**
 * Hitung berapa baris tabel yang muat di wadah tanpa scroll. Dipakai sebagai "per halaman"
 * otomatis, jadi tabel selalu pas setinggi layar dan sisanya lewat paginasi. Lebar ikut
 * dikembalikan supaya tabel bisa menyembunyikan kolom saat sempit.
 */
export function useFitRows(rowHeight: number, headerHeight: number, min = 3) {
  const { ref, width, height } = useElementSize()
  const rows = height ? Math.max(min, Math.floor((height - headerHeight) / rowHeight)) : 10
  return { ref, rows, width }
}
