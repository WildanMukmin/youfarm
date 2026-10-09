/** Protokol untuk memutar hasil job di renderer tanpa membuka akses file:// sembarang. */
export const MEDIA_SCHEME = 'youfarm-media'

export type MediaKind = 'video' | 'thumb'

export const mediaUrl = (jobId: string, kind: MediaKind): string => `${MEDIA_SCHEME}://job/${jobId}/${kind}`
