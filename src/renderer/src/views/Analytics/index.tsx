import { ChartColumn } from 'lucide-react'
import Workspace from '@/layout/Workspace'
import EmptyState from '@/ui/EmptyState'
import StatusChip from '@/ui/StatusChip'

export default function AnalyticsView() {
  return (
    <Workspace title="Analitik" subtitle="Performa channel dan video dari YouTube Analytics." actions={<StatusChip tone="idle">Segera</StatusChip>}>
      <EmptyState icon={ChartColumn} title="Dashboard analitik sedang dikembangkan">
        Izin analitik sudah diminta saat Anda menghubungkan channel, jadi dashboard bisa langsung memakainya begitu siap.
      </EmptyState>
    </Workspace>
  )
}
