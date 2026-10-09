import { useEffect } from 'react'
import { DEFAULT_OPTIONS, validateOptions, type FaktaUnikOptions } from '@shared/modes/fakta-unik'
import { useStickyState } from '@/hooks/useStickyState'

const PREFS_KEY = 'youfarm:fakta-unik:prefs'

/** Pilihan terakhir (bahasa, suara, caption, footage) dibawa ke sesi berikutnya; topik tidak. */
function loadPrefs(): FaktaUnikOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Record<string, unknown> | null
    if (!raw) return DEFAULT_OPTIONS
    return { ...validateOptions({ ...raw, topic: 'pref' }), topic: '', avoid: [] }
  } catch {
    return DEFAULT_OPTIONS
  }
}

let initial: FaktaUnikOptions | null = null

/**
 * Opsi form Fakta Unik, dipakai bersama oleh form (panel kiri) dan pratinjau caption (tengah).
 * Bertahan saat pindah menu; selain topik, juga tersimpan untuk sesi berikutnya.
 */
export function useFaktaOptions() {
  const [opts, setOpts] = useStickyState<FaktaUnikOptions>('fakta-unik:form', (initial ??= loadPrefs()))

  useEffect(() => {
    try {
      const { topic: _topic, avoid: _avoid, ...prefs } = opts
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* penyimpanan tidak tersedia: pilihan hanya bertahan selama aplikasi terbuka */
    }
  }, [opts])

  return [opts, setOpts] as const
}
