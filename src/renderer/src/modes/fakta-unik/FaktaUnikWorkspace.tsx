import { useState } from 'react'
import { toast } from 'sonner'
import CaptionPreview from '@/components/CaptionPreview'
import JobStage from '@/components/JobStage'
import PublishPanel from '@/components/PublishPanel'
import ScriptPanel from '@/components/ScriptPanel'
import { useModeJob } from '@/hooks/useModeJob'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import { errMsg } from '@/lib/errors'
import Panel from '@/ui/Panel'
import PanelTabs from '@/ui/PanelTabs'
import StatusChip from '@/ui/StatusChip'
import FaktaUnikForm from './FaktaUnikForm'
import { useFaktaOptions } from './useFaktaOptions'

type RightTab = 'naskah' | 'publikasi'

export default function FaktaUnikWorkspace({ onNavigate }: ViewProps) {
  const job = useModeJob('fakta-unik')
  const [opts, setOpts] = useFaktaOptions()
  const [tab, setTab] = useState<RightTab>('naskah')
  const result = job.state.phase === 'done' ? job.state.result : null

  const open = async (what: 'file' | 'folder') => {
    if (!result) return
    try {
      await window.youfarm.modes.open(result.jobId, what)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const status =
    job.state.phase === 'running' ? (
      <StatusChip tone="active">Membuat video</StatusChip>
    ) : job.state.phase === 'done' ? (
      <StatusChip tone="done">Selesai</StatusChip>
    ) : job.state.phase === 'error' ? (
      <StatusChip tone={job.state.cancelled ? 'idle' : 'error'}>{job.state.cancelled ? 'Dibatalkan' : 'Gagal'}</StatusChip>
    ) : null

  return (
    <Workspace
      title="Fakta Unik"
      leftWidth={320}
      rightWidth={300}
      subtitle="Satu topik jadi Short 30–60 detik: naskah, suara, footage, caption."
      actions={status}
      left={<FaktaUnikForm opts={opts} setOpts={setOpts} running={job.state.phase === 'running'} onSubmit={(o) => void job.run(o)} onOpenSettings={() => onNavigate('settings')} onOpenQueue={() => onNavigate('queue')} onOpenAccounts={() => onNavigate('accounts')} />}
      right={
        <Panel title={<PanelTabs label="Panel hasil" tabs={[{ id: 'naskah', label: 'Naskah' }, { id: 'publikasi', label: 'Publikasi' }]} active={tab} onChange={setTab} />}>
          {tab === 'naskah' ? (
            <ScriptPanel result={result} />
          ) : result ? (
            <PublishPanel result={result} onOpenQueue={() => onNavigate('queue')} onOpenAccounts={() => onNavigate('accounts')} />
          ) : (
            <p className="text-sm text-ink-muted">Selesaikan video dulu, lalu masukkan ke antrean upload dari sini.</p>
          )}
        </Panel>
      }
    >
      <JobStage
        state={job.state}
        onCancel={job.cancel}
        onReset={job.reset}
        onOpen={(w) => void open(w)}
        idleHint="Isi topik di panel kiri, lalu klik Buat video. Pratinjau muncul di sini."
        idle={<CaptionPreview style={opts.caption} language={opts.language} />}
      />
    </Workspace>
  )
}
