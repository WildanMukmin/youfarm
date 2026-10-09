import { app } from 'electron'
import { join } from 'node:path'
import { createFfmpeg, type Ffmpeg } from './ffmpeg'

/** Folder binary: `binaries/win-x64` saat pengembangan, `resources/bin` di aplikasi terpasang. */
export function binDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'bin') : join(app.getAppPath(), 'binaries', 'win-x64')
}

let ffmpeg: Ffmpeg | null = null

export function getFfmpeg(): Ffmpeg {
  if (!ffmpeg) ffmpeg = createFfmpeg(binDir())
  return ffmpeg
}
