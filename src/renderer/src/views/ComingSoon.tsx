import { MODE_INFO, type ModeId } from '@shared/contracts/modes'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import Button from '@/ui/Button'
import StatusChip from '@/ui/StatusChip'

/** Ruang kerja untuk mode yang belum tersedia. Tiap mode tetap punya menu sendiri. */
export default function ComingSoon({ mode, onNavigate }: ViewProps & { mode: ModeId }) {
  const info = MODE_INFO.find((m) => m.id === mode)!
  return (
    <Workspace title={info.label} subtitle={info.hint} actions={<StatusChip tone="idle">Segera</StatusChip>}>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <p className="font-display text-lg font-semibold">Mode {info.label} sedang dikembangkan</p>
          <p className="mt-2 text-sm text-ink-muted">Mode ini akan punya ruang kerjanya sendiri, terpisah dari mode lain. Sementara itu, Fakta Unik sudah bisa dipakai.</p>
          <div className="mt-5">
            <Button variant="ghost" onClick={() => onNavigate('fakta-unik')}>
              Buka Fakta Unik
            </Button>
          </div>
        </div>
      </div>
    </Workspace>
  )
}
