import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { PRODUCTION_MODE_IDS } from '@shared/contracts/modes'
import type { ProductionDetail, ProductionEnqueueRequest, ProductionPublishRequest, ProductionPublishResult, ProductionSnapshot, PublishPlan } from '@shared/production'
import { isChannelId } from '@shared/youtube/accounts'
import type { Privacy } from '@shared/youtube/metadata'
import { getAccountService } from '../youtube/account'
import { getUploadQueue } from '../youtube/queue'
import { handleMediaProtocol } from '../platform/media-protocol'
import { enqueueRendered } from '../modes/publish'
import { getProductionQueue, pauseProductionQueue, resumeProductionQueue } from '../production'
import { deleteVideoFiles } from '../production/files'

const PRIVACY: Privacy[] = ['private', 'unlisted', 'public']

const THUMB_MAX_BYTES = 2 * 1024 * 1024
const THUMB_MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }
/** Thumbnail pilihan pengguna per job. Path hanya dikenal main; renderer cuma menyatakan "pakai yang dipilih". */
const pickedThumbs = new Map<number, string>()

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

/**
 * Hapus video jadi beserta berkasnya (mp4, thumbnail, SRT) dari komputer. Upload yang masih menunggu ikut dibatalkan
 * karena berkasnya hilang; upload yang sedang berjalan menolak penghapusan. Gagal menghapus berkas (mis. sedang
 * diputar) membatalkan semuanya supaya daftar dan isi folder tetap cocok.
 */
async function removeWithFiles(id: number): Promise<void> {
  const res = q().result(id)
  if (!res) return q().remove(id)
  const uploadId = q().detail(id)?.uploadId
  const upload = uploadId ? getUploadQueue().snapshot().items.find((i) => i.id === uploadId) : undefined
  if (upload?.status === 'uploading') throw new Error('Video ini sedang diunggah. Tunggu selesai, lalu hapus.')

  const { filePath, thumbnailPath, captionPath } = res.video
  await deleteVideoFiles([filePath, thumbnailPath, captionPath])
  if (upload && upload.status !== 'done') getUploadQueue().remove(upload.id)
  q().remove(id)
}

const q = getProductionQueue

export function registerProductionIpc(): void {
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
    const out = enqueueRendered(rec, {
      channelId: req.channelId,
      privacy: req.privacy,
      schedule: req.schedule,
      title: req.title,
      description: req.description,
      tags: req.tags,
      thumbnailPath: req.customThumbnail ? (pickedThumbs.get(id) ?? null) : null
    })
    pickedThumbs.delete(id)
    q().attachUpload(id, out.queueId)
    return out
  })
  ipcMain.handle(IPC.prodPickThumbnail, async (e, id: unknown): Promise<string | null> => {
    const jid = jobId(id)
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts = { title: 'Pilih thumbnail', properties: ['openFile' as const], filters: [{ name: 'Gambar (JPG atau PNG)', extensions: ['jpg', 'jpeg', 'png'] }] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const file = r.filePaths[0]
    if (r.canceled || !file) return null
    const mime = THUMB_MIME[extname(file).toLowerCase()]
    if (!mime) throw new Error('Thumbnail harus berupa JPG atau PNG.')
    if ((await stat(file)).size > THUMB_MAX_BYTES) throw new Error('Thumbnail maksimal 2 MB (batas YouTube).')
    pickedThumbs.set(jid, file)
    return `data:${mime};base64,${(await readFile(file)).toString('base64')}`
  })
  ipcMain.handle(IPC.prodCancel, (_e, id: unknown): ProductionSnapshot => (q().cancel(jobId(id)), q().snapshot()))
  ipcMain.handle(IPC.prodRetry, (_e, id: unknown): ProductionSnapshot => (q().retry(jobId(id)), q().snapshot()))
  ipcMain.handle(IPC.prodRemove, async (_e, id: unknown): Promise<ProductionSnapshot> => (await removeWithFiles(jobId(id)), q().snapshot()))
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
