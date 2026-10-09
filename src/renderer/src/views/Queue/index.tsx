import { CloudUpload, Factory, Pause, Play } from 'lucide-react'
import { needsAttention } from '@shared/youtube/queue'
import { useQueue } from '@/hooks/useQueue'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import Button from '@/ui/Button'
import PanelTabs from '@/ui/PanelTabs'
import StatusChip from '@/ui/StatusChip'
import ProductionTab from './ProductionTab'
import UploadTab from './UploadTab'

type Tab = 'upload' | 'produksi'

function RunControls({ running, onPause, onResume, what }: { running: boolean; onPause: () => void; onResume: () => void; what: string }) {
  return (
    <>
      <StatusChip tone={running ? 'active' : 'warn'}>{running ? 'Berjalan' : 'Dijeda'}</StatusChip>
      {running ? (
        <Button variant="ghost" size="sm" onClick={onPause} title={`Hentikan ${what} sementara. Yang sedang berjalan kembali antre.`}>
          <span className="flex items-center gap-1.5">
            <Pause size={14} aria-hidden /> Jeda
          </span>
        </Button>
      ) : (
        <Button size="sm" onClick={onResume}>
          <span className="flex items-center gap-1.5">
            <Play size={14} aria-hidden /> Lanjutkan
          </span>
        </Button>
      )}
    </>
  )
}

export default function QueueView({ onNavigate }: ViewProps) {
  const q = useQueue()
  const [tab, setTab] = useStickyState<Tab>('antrean:tab', 'upload')
  const up = q.snapshot
  const prod = q.production
  const upItems = up?.items ?? []
  const prodItems = prod?.items ?? []
  const upAttention = upItems.filter(needsAttention).length
  const upPending = upItems.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  const prodActive = prodItems.filter((j) => j.status === 'queued' || j.status === 'running').length
  const prodFailed = prodItems.filter((j) => j.status === 'failed').length

  const subtitle =
    tab === 'upload'
      ? `${upPending} menunggu diunggah${upAttention ? ` · ${upAttention} perlu perhatian` : ''} · berjalan di latar, lanjut saat aplikasi dibuka lagi`
      : `${prodActive} video dalam antrean produksi${prodFailed ? ` · ${prodFailed} gagal` : ''} · dibuat satu per satu di latar`

  const actions =
    tab === 'upload'
      ? up && <RunControls running={up.running} onPause={() => void q.pause()} onResume={() => void q.resume()} what="upload" />
      : prod && <RunControls running={prod.running} onPause={() => void q.prod.pause()} onResume={() => void q.prod.resume()} what="produksi" />

  return (
    <Workspace
      title="Antrean"
      subtitle={up && prod ? subtitle : 'Memuat…'}
      actions={actions}
      tabs={
        <PanelTabs
          variant="bar"
          label="Jenis antrean"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'upload', label: 'Upload', count: upItems.length, icon: <CloudUpload size={15} aria-hidden /> },
            { id: 'produksi', label: 'Produksi', count: prodItems.length, icon: <Factory size={15} aria-hidden /> }
          ]}
        />
      }
    >
      {tab === 'upload' && up && (
        <UploadTab
          snapshot={up}
          channelNames={q.channelNames}
          onRetry={(id) => void q.retry(id)}
          onRemove={(id) => void q.remove(id)}
          onOpen={(id) => void q.openVideo(id)}
          onCreate={() => onNavigate('fakta-unik')}
        />
      )}
      {tab === 'produksi' && prod && (
        <ProductionTab
          snapshot={prod}
          channelNames={q.channelNames}
          onCancel={(id) => void q.prod.cancel(id)}
          onRetry={(id) => void q.prod.retry(id)}
          onRemove={(id) => void q.prod.remove(id)}
          onOpen={(id, w) => void q.prod.open(id, w)}
          onOpenUpload={() => setTab('upload')}
          onCreate={() => onNavigate('fakta-unik')}
        />
      )}
    </Workspace>
  )
}
