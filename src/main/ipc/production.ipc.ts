import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { PRODUCTION_MODE_IDS } from '@shared/contracts/modes'
import type { ProductionDetail, ProductionEnqueueRequest, ProductionPublishRequest, ProductionPublishResult, ProductionSnapshot, PublishPlan } from '@shared/production'
import { isChannelId } from '@shared/youtube/accounts'
import type { Privacy } from '@shared/youtube/metadata'
import { getAccountService } from '../youtube/account'
import { handleMediaProtocol } from '../platform/media-protocol'
import { enqueueRendered } from '../modes/publish'
import { getProductionQueue, pauseProductionQueue, resumeProductionQueue } from '../production'

const PRIVACY: Privacy[] = ['private', 'unlisted', 'public']

function jobId(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new Error('ID job tidak valid.')
  return v
}

/** Rencana publikasi dari renderer divalidasi di sini; channel harus terhubung saat diantrekan. */
function publishPlan(v: unknown): PublishPlan | null {
  if (v == null) return null
  const p = v as Partial<PublishPlan>
  if (!isChannelId(p.channelId)) throw new Error('Pilih channel tujuan untuk unggah otomatis.')
  const channelId = p.channelId
  if (!getAccountService().status().accounts.some((a) => a.channel.id === channelId)) throw new Error('Channel tujuan tidak terhubung.')
  return { channelId, privacy: PRIVACY.includes(p.privacy as Privacy) ? (p.privacy as Privacy) : 'private', schedule: p.schedule === true }
}

export function registerProductionIpc(): void {
  const q = getProductionQueue

  // Pratinjau di renderer: id job dikenali main, path berkas tidak pernah datang dari renderer.
  handleMediaProtocol((id, kind) => {
    if (!/^\d{1,9}$/.test(id)) return undefined
    const video = q().result(Number(id))?.video
    if (kind === 'video') return video?.filePath
    if (kind === 'thumb') return video?.thumbnailPath ?? undefined
    return undefined
  })

  ipcMain.handle(IPC.prodSnapshot, (): ProductionSnapshot => q().snapshot())
  ipcMain.handle(IPC.prodEnqueue, (_e, req: Partial<ProductionEnqueueRequest>): number[] => {
    if (!PRODUCTION_MODE_IDS.includes(req?.mode as never)) throw new Error('Mode tidak valid.')
    return q().enqueue({ mode: req.mode!, options: Array.isArray(req.options) ? req.options : [], publish: publishPlan(req.publish) })
  })
  ipcMain.handle(IPC.prodDetail, (_e, id: unknown): ProductionDetail | null => q().detail(jobId(id)))
  ipcMain.handle(IPC.prodPublish, (_e, req: Partial<ProductionPublishRequest>): ProductionPublishResult => {
    const id = jobId(req?.id)
    const rec = q().result(id)
    if (!rec) throw new Error('Video ini belum jadi.')
    if (q().detail(id)?.uploadId) throw new Error('Video ini sudah masuk antrean upload.')
    const out = enqueueRendered(rec, { channelId: req.channelId, privacy: req.privacy, schedule: req.schedule })
    q().attachUpload(id, out.queueId)
    return out
  })
  ipcMain.handle(IPC.prodCancel, (_e, id: unknown): ProductionSnapshot => (q().cancel(jobId(id)), q().snapshot()))
  ipcMain.handle(IPC.prodRetry, (_e, id: unknown): ProductionSnapshot => (q().retry(jobId(id)), q().snapshot()))
  ipcMain.handle(IPC.prodRemove, (_e, id: unknown): ProductionSnapshot => (q().remove(jobId(id)), q().snapshot()))
  ipcMain.handle(IPC.prodPause, (): ProductionSnapshot => (pauseProductionQueue(), q().snapshot()))
  ipcMain.handle(IPC.prodResume, (): ProductionSnapshot => (resumeProductionQueue(), q().snapshot()))

  // Berkas dibuka berdasarkan id job yang dikenal main, bukan path dari renderer.
  ipcMain.handle(IPC.prodOpen, async (_e, id: unknown, what: unknown): Promise<void> => {
    const res = q().result(jobId(id))
    if (!res) throw new Error('Video ini belum jadi.')
    if (what === 'folder') return shell.showItemInFolder(res.video.filePath)
    const err = await shell.openPath(res.video.filePath)
    if (err) throw new Error(`Tidak bisa membuka video: ${err}`)
  })
}
