import type { ModeId } from '@shared/contracts/modes'

/** Tiap mode punya menu sendiri; sisanya menu umum. */
export type ViewId = ModeId | 'queue' | 'library' | 'analytics' | 'accounts' | 'settings'

/** Properti yang diterima setiap halaman. Halaman yang tidak butuh navigasi boleh mengabaikannya. */
export interface ViewProps {
  onNavigate: (to: ViewId) => void
}
