import { ipcMain } from 'electron'
import { IPC, type YoutubeAccountStatus, type YoutubeDisconnectResult } from '@shared/ipc-channels'
import { isChannelId } from '@shared/youtube/accounts'
import { getAccountService } from '../youtube/account'
import { getUploadQueue } from '../youtube/queue'

function channelId(v: unknown): string {
  if (!isChannelId(v)) throw new Error('ID kanal tidak valid.')
  return v
}

export function registerYoutubeIpc(): void {
  const svc = getAccountService

  ipcMain.handle(IPC.ytStatus, (): YoutubeAccountStatus => svc().status())

  ipcMain.handle(IPC.ytSetCredentials, (_e, clientId: unknown, clientSecret: unknown): YoutubeAccountStatus => {
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') throw new Error('Isian tidak valid.')
    if (clientId.length > 300 || clientSecret.length > 300) throw new Error('Isian terlalu panjang.')
    return svc().setCredentials(clientId, clientSecret)
  })

  ipcMain.handle(IPC.ytConnect, async (): Promise<YoutubeAccountStatus> => {
    const status = await svc().connect()
    // Akun yang baru dihubungkan ulang: item antreannya yang terblokir boleh jalan lagi.
    for (const a of status.accounts) if (a.canUpload) getUploadQueue().unblockChannel(a.channel.id)
    return status
  })
  ipcMain.handle(IPC.ytCancelConnect, (): void => svc().cancelConnect())
  ipcMain.handle(IPC.ytCheck, (_e, id: unknown): Promise<YoutubeAccountStatus> => svc().check(channelId(id)))
  ipcMain.handle(IPC.ytDisconnect, (_e, id: unknown): Promise<YoutubeDisconnectResult> => svc().disconnect(channelId(id)))
  ipcMain.handle(IPC.ytSetSlots, (_e, id: unknown, times: unknown): YoutubeAccountStatus => svc().setSlots(channelId(id), times))
  ipcMain.handle(IPC.ytClearCredentials, (): Promise<YoutubeDisconnectResult> => svc().clearCredentials())
}
