const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const slot = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatDate = (iso: string): string => date.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso))
/** Mis. "Jum, 10 Okt 12.00": untuk jadwal tayang, hari ikut disebut. */
export const formatSlot = (iso: string): string => slot.format(new Date(iso))
/** "07:00" -> "07.00" (gaya penulisan jam Indonesia). */
export const formatClock = (hhmm: string): string => hhmm.replace(':', '.')
/** Detik jadi "m:ss", mis. 75 -> "1:15". */
export const formatDuration = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
