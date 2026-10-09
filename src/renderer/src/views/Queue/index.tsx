import { CloudUpload, Factory, Pause, Play } from 'lucide-react'
import { needsAttention } from '@shared/youtube/queue'
import { useQueue } from '@/hooks/useQueue'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import Button from '@/ui/Button'
import PanelTabs from '@/ui/PanelTabs'
import StatusChip from '@/ui/StatusChip'
import UploadTab from './UploadTab'

type Tab = 'upload' | 'produksi'

export default function QueueView({ onNavigate }: ViewProps) {
  const q = useQueue()
  const [tab, setTab] = useStickyState<Tab>('antrean:tab', 'upload')
  const snap = q.snapshot
  const items = snap?.items ?? []
  const attention = items.filter(needsAttention).length
  const pending = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length

  const actions = snap && (
    <>
      <StatusChip tone={snap.running ? 'active' : 'warn'}>{snap.running ? 'Berjalan' : 'Dijeda'}</StatusChip>
      {snap.running ? (
        <Button variant="ghost" size="sm" onClick={() => void q.pause()} title="Hentikan upload sementara. Upload yang sedang berjalan kembali antre.">
          <span className="flex items-center gap-1.5">
            <Pause size={14} aria-hidden /> Jeda
          </span>
        </Button>
      ) : (
        <Button size="sm" onClick={() => void q.resume()}>
          <span className="flex items-center gap-1.5">
            <Play size={14} aria-hidden /> Lanjutkan
          </span>
        </Button>
      )}
    </>
  )

  return (
    <Workspace
      title="Antrean"
      subtitle={snap ? `${pending} menunggu${attention ? ` · ${attention} perlu perhatian` : ''} · upload berjalan di latar dan lanjut saat aplikasi dibuka lagi` : 'Memuat…'}
      actions={actions}
      tabs={
        <PanelTabs
          variant="bar"
          label="Jenis antrean"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'upload', label: 'Upload', count: items.length, icon: <CloudUpload size={15} aria-hidden /> },
            { id: 'produksi', label: 'Produksi', soon: 'Segera', icon: <Factory size={15} aria-hidden /> }
          ]}
        />
      }
    >
      {snap ? (
        <UploadTab
          snapshot={snap}
          channelNames={q.channelNames}
          onRetry={(id) => void q.retry(id)}
          onRemove={(id) => void q.remove(id)}
          onOpen={(id) => void q.openVideo(id)}
          onCreate={() => onNavigate('fakta-unik')}
        />
      ) : null}
    </Workspace>
  )
}
