import { needsAttention, type QueueItem } from '@shared/youtube/queue'
import QuotaMeter from '@/components/QuotaMeter'
import { useQueue } from '@/hooks/useQueue'
import Card from '@/ui/Card'
import PageHeader from '@/ui/PageHeader'
import QueueRow from './QueueRow'

export default function QueueView() {
  const { snapshot, channelNames, retry, remove } = useQueue()

  if (!snapshot) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <PageHeader title="Antrean" />
        <p className="text-ink-muted">Memuat…</p>
      </section>
    )
  }

  const attention = snapshot.items.filter(needsAttention)
  const active = snapshot.items.filter((i) => i.status === 'queued' || i.status === 'uploading').reverse()
  const done = snapshot.items.filter((i) => i.status === 'done')

  const list = (items: QueueItem[]) => (
    <ul className="grid gap-3">
      {items.map((i) => (
        <QueueRow key={i.id} item={i} channelName={channelNames[i.channelId] ?? i.channelId} onRetry={(id) => void retry(id)} onRemove={(id) => void remove(id)} />
      ))}
    </ul>
  )

  return (
    <section className="mx-auto max-w-3xl p-8 pb-16">
      <PageHeader title="Antrean" subtitle="Video yang menunggu diunggah ke YouTube. Berjalan di latar dan dilanjutkan bila aplikasi dibuka lagi." />
      <div className="grid gap-5">
        <Card title="Kuota">
          <QuotaMeter quota={snapshot.quota} />
        </Card>

        {attention.length > 0 && (
          <Card title={`Perlu perhatian (${attention.length})`} description="Antrean tetap jalan untuk video lain.">
            {list(attention)}
          </Card>
        )}

        <Card title={`Antre (${active.length})`}>
          {active.length === 0 ? <p className="text-sm text-ink-muted">Tidak ada video yang menunggu. Video yang dibuat dari menu Buat muncul di sini.</p> : list(active)}
        </Card>

        {done.length > 0 && (
          <Card title={`Selesai (${done.length})`}>
            {list(done)}
          </Card>
        )}
      </div>
    </section>
  )
}
