import { rm } from 'node:fs/promises'

/**
 * Hapus berkas hasil video dari disk. Berkas yang sudah tidak ada diabaikan. Berkas yang terkunci (sedang diputar)
 * atau gagal dihapus melempar error berbahasa jelas, setelah berkas lain tetap dicoba.
 */
export async function deleteVideoFiles(paths: (string | null | undefined)[]): Promise<void> {
  let failure: Error | null = null
  for (const file of paths) {
    if (!file) continue
    try {
      await rm(file, { force: true })
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      failure ??= new Error(
        code === 'EBUSY' || code === 'EPERM' ? 'Berkas video sedang dipakai program lain (mungkin sedang diputar). Tutup dulu, lalu hapus lagi.' : `Gagal menghapus berkas: ${(e as Error).message}`
      )
    }
  }
  if (failure) throw failure
}
