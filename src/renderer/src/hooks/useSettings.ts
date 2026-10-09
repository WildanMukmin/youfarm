import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { SecretStatus, Settings } from '@shared/settings'
import { errMsg } from '@/lib/errors'

/** Muat settings dan status key sekali, lalu sediakan pembaruan yang menyinkronkan keduanya. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<SecretStatus | null>(null)

  useEffect(() => {
    const api = window.youfarm
    if (!api) return
    void Promise.all([api.settings.get(), api.secrets.status()]).then(([s, st]) => {
      setSettings(s)
      setStatus(st)
    })
  }, [])

  const update = useCallback(async (patch: Partial<Settings>) => {
    try {
      setSettings(await window.youfarm.settings.update(patch))
    } catch (e) {
      toast.error(errMsg(e, 'Gagal menyimpan pengaturan.'))
    }
  }, [])

  /** Dipanggil setelah daftar key berubah. */
  const changeSecrets = useCallback((next: SecretStatus) => setStatus(next), [])

  return { settings, status, update, changeSecrets }
}
