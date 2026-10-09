/** Pesan error dari IPC dibungkus Electron ("Error invoking remote method 'x': Error: ..."). Ambil isinya saja. */
export function errMsg(e: unknown, fallback = 'Terjadi kesalahan.'): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const clean = raw.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^Error:\s*/, '')
  return clean || fallback
}
