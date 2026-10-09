import { Hourglass } from 'lucide-react'
import { MODE_INFO, type ModeId } from '@shared/contracts/modes'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import Button from '@/ui/Button'
import EmptyState from '@/ui/EmptyState'
import StatusChip from '@/ui/StatusChip'

/** Ruang kerja untuk mode yang belum tersedia. Tiap mode tetap punya menu sendiri. */
export default function ComingSoon({ mode, onNavigate }: ViewProps & { mode: ModeId }) {
  const info = MODE_INFO.find((m) => m.id === mode)!
  return (
    <Workspace title={info.label} subtitle={info.hint} actions={<StatusChip tone="idle">Segera</StatusChip>}>
      <EmptyState
        icon={Hourglass}
        title={`Mode ${info.label} sedang dikembangkan`}
        action={
          <Button variant="ghost" onClick={() => onNavigate('fakta-unik')}>
            Buka Fakta Unik
          </Button>
        }
      >
        Mode ini akan punya ruang kerjanya sendiri, terpisah dari mode lain. Sementara itu, Fakta Unik sudah bisa dipakai.
      </EmptyState>
    </Workspace>
  )
}
