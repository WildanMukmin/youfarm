/** Protokol untuk memutar hasil video di renderer tanpa membuka akses file:// sembarang. */
export const MEDIA_SCHEME = 'youfarm-media'

export type MediaKind = 'video' | 'thumb'

/** `id` adalah id job produksi; file-nya ditentukan main, bukan renderer. */
export const mediaUrl = (id: number, kind: MediaKind): string => `${MEDIA_SCHEME}://prod/${id}/${kind}`
