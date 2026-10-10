import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AspectRatio } from '@shared/contracts/modes'
import type { ProductionDetail } from '@shared/production'
import CaptionPreview from '@/components/CaptionPreview'
import JobStage from '@/components/JobStage'
import PublishPanel from '@/components/PublishPanel'
import RecentJobs from '@/components/RecentJobs'
import ScriptPanel from '@/components/ScriptPanel'
import { refreshQueues, useQueue } from '@/hooks/useQueue'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import type { ViewProps } from '@/layout/views'
import Panel from '@/ui/Panel'
import PanelTabs from '@/ui/PanelTabs'
import StatusChip from '@/ui/StatusChip'
import FaktaUnikForm, { type FormTab } from './FaktaUnikForm'
import { useFaktaOptions } from './useFaktaOptions'

type RightTab = 'naskah' | 'publikasi'
const RECENT = 8

export default function FaktaUnikWorkspace({ onNavigate }: ViewProps) {
  const [opts, setOpts] = useFaktaOptions()
  const [formTab, setFormTab] = useStickyState<FormTab>('fakta-unik:tab', 'konten')
  const [tab, setTab] = useState<RightTab>('naskah')
  // Video yang dipilih pengguna (klik di daftar, atau baru dimasukkan). Tanpa pilihan: yang sedang dibuat, lalu yang terbaru.
  const [pinned, setPinned] = useStickyState<number | null>('fakta-unik:pinned', null)
  // Format yang dicentang di form; bingkai pratinjau kosong mengikuti yang pertama.
  const [aspects, setAspects] = useStickyState<AspectRatio[]>('fakta-unik:aspects', ['9:16'])
  const { production, prod } = useQueue()

  const jobs = (production?.items ?? []).filter((j) => j.mode === 'fakta-unik')
  const job = jobs.find((j) => j.id === pinned) ?? jobs.find((j) => j.status === 'running') ?? jobs[0] ?? null

  const [detail, setDetail] = useState<ProductionDetail | null>(null)
  const jobId = job?.id
  const done = job?.status === 'done'
  const uploadId = job?.uploadId
  useEffect(() => {
    if (jobId === undefined || !done) return setDetail(null)
    let live = true
    void window.youfarm.production.detail(jobId).then((d) => live && setDetail(d))
    return () => {
      live = false
    }
  }, [jobId, done, uploadId])

  const shown = detail && detail.id === jobId ? detail : null

  // Memilih atau memasukkan video berarti ingin melihatnya, jadi keluar dari mode sunting caption.
  const show = (id: number | null): void => {
    setPinned(id)
    if (formTab === 'caption') setFormTab('konten')
  }

  const open = async (id: number, what: 'file' | 'folder') => {
    try {
      await window.youfarm.production.open(id, what)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuka berkas.')
    }
  }

  const status = job ? (
    job.status === 'running' ? (
      <StatusChip tone="active">{`Membuat video ${job.percent}%`}</StatusChip>
    ) : job.status === 'queued' ? (
      <StatusChip tone="idle">Menunggu giliran</StatusChip>
    ) : job.status === 'done' ? (
      <StatusChip tone="done">Selesai</StatusChip>
    ) : (
      <StatusChip tone={job.status === 'cancelled' ? 'idle' : 'error'}>{job.status === 'cancelled' ? 'Dibatalkan' : 'Gagal'}</StatusChip>
    )
  ) : null

  return (
    <Workspace
      title="Fakta Unik"
      leftWidth={320}
      rightWidth={340}
      subtitle="Satu topik jadi video pendek: naskah, suara, footage, caption."
      actions={status}
      left={
        <FaktaUnikForm
          opts={opts}
          setOpts={setOpts}
          tab={formTab}
          onTab={setFormTab}
          aspects={aspects}
          onAspects={setAspects}
          onQueued={(ids) => {
            show(ids[0] ?? null)
            refreshQueues()
          }}
          onOpenSettings={() => onNavigate('settings')}
          onOpenQueue={() => onNavigate('queue')}
          onOpenAccounts={() => onNavigate('accounts')}
        />
      }
      right={
        <Panel title={<PanelTabs label="Panel hasil" tabs={[{ id: 'naskah', label: 'Naskah' }, { id: 'publikasi', label: 'Publikasi' }]} active={tab} onChange={setTab} />}>
          {tab === 'naskah' ? (
            <ScriptPanel result={shown} />
          ) : shown ? (
            <PublishPanel key={shown.id} result={shown} onOpenQueue={() => onNavigate('queue')} onOpenAccounts={() => onNavigate('accounts')} />
          ) : (
            <p className="text-sm text-ink-muted">Pilih video yang sudah jadi, lalu masukkan ke antrean upload dari sini.</p>
          )}
        </Panel>
      }
    >
      <JobStage
        job={job}
        detail={shown}
        paused={production ? !production.running : false}
        onCancel={(id) => void prod.cancel(id)}
        onRetry={(id) => void prod.retry(id)}
        onResume={() => void prod.resume()}
        onOpen={(id, what) => void open(id, what)}
        idleHint="Isi topik di panel kiri, lalu klik Buat video. Pratinjau muncul di sini."
        idleAspect={aspects[0]}
        idle={<CaptionPreview style={opts.caption} language={opts.language} />}
        forceIdle={formTab === 'caption'}
      />
      <RecentJobs jobs={jobs.slice(0, RECENT)} selectedId={job?.id ?? null} onSelect={show} />
    </Workspace>
  )
}
