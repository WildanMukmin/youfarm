import { Library } from 'lucide-react'
import Workspace from '@/layout/Workspace'
import EmptyState from '@/ui/EmptyState'
import StatusChip from '@/ui/StatusChip'

export default function LibraryView() {
  return (
    <Workspace title="Library" subtitle="Riwayat semua video yang pernah dibuat." actions={<StatusChip tone="idle">Segera</StatusChip>}>
      <EmptyState icon={Library} title="Library sedang dikembangkan">
        Di sini nanti semua video hasil produksi bisa dibuka, dijadwalkan ulang, atau dihapus.
      </EmptyState>
    </Workspace>
  )
}
