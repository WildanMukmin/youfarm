import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { YoutubeAccountStatus } from '@shared/youtube/accounts'
import { errMsg } from '@/lib/errors'

/** Status akun YouTube dan aksinya. Semua pemanggilan lewat IPC; token tidak pernah sampai ke sini. */
export function useYoutubeAccounts() {
  const [status, setStatus] = useState<YoutubeAccountStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void window.youfarm?.youtube.status().then(setStatus)
  }, [])

  const setCredentials = useCallback(async (clientId: string, clientSecret: string): Promise<boolean> => {
    try {
      setStatus(await window.youfarm.youtube.setCredentials(clientId, clientSecret))
      toast.success('Kredensial disimpan terenkripsi.')
      return true
    } catch (e) {
      toast.error(errMsg(e))
      return false
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      setStatus(await window.youfarm.youtube.connect())
      toast.success('Akun terhubung.')
    } catch (e) {
      const m = errMsg(e)
      if (m.includes('dibatalkan')) toast.info(m)
      else toast.error(m)
    } finally {
      setConnecting(false)
    }
  }, [])

  const cancelConnect = useCallback(() => void window.youfarm.youtube.cancelConnect(), [])

  const check = useCallback(async (channelId: string) => {
    setBusyId(channelId)
    try {
      const next = await window.youfarm.youtube.check(channelId)
      setStatus(next)
      const acc = next.accounts.find((a) => a.channel.id === channelId)
      if (acc?.state === 'reconnect') toast.error('Token tidak berlaku lagi. Hubungkan ulang akun ini.')
      else toast.success('Token masih berlaku.')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }, [])

  const disconnect = useCallback(async (channelId: string) => {
    setBusyId(channelId)
    try {
      const r = await window.youfarm.youtube.disconnect(channelId)
      setStatus(r.status)
      if (r.revoked) toast.success('Akun diputuskan dan aksesnya dicabut di Google.')
      else toast.warning('Akun dilepas dari aplikasi, tetapi akses belum dicabut di Google. Cabut manual di myaccount.google.com/permissions.')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }, [])

  const clearCredentials = useCallback(async () => {
    try {
      const r = await window.youfarm.youtube.clearCredentials()
      setStatus(r.status)
      toast.success('Kredensial dan semua akun dihapus.')
    } catch (e) {
      toast.error(errMsg(e))
    }
  }, [])

  return { status, connecting, busyId, setCredentials, connect, cancelConnect, check, disconnect, clearCredentials }
}
