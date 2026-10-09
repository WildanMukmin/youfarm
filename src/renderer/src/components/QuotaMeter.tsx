import { DAILY_QUOTA, QUOTA_COST } from '@shared/youtube/quota'
import type { QuotaSnapshot } from '@shared/youtube/queue'
import ProgressBar from '@/ui/ProgressBar'

function untilReset(resetAt: string): string {
  const ms = Math.max(0, new Date(resetAt).getTime() - Date.now())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} j ${m} mnt` : `${m} mnt`
}

const nf = new Intl.NumberFormat('id-ID')

/** Penghitung kuota harian YouTube: seberapa terpakai, berapa upload tersisa, kapan reset. */
export default function QuotaMeter({ quota }: { quota: QuotaSnapshot }) {
  const pct = (quota.used / DAILY_QUOTA) * 100
  const low = quota.remaining < QUOTA_COST.videoUpload
  const tone = low ? 'amber' : 'crimson'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 font-mono text-xs text-ink-muted">
        <span>KUOTA YOUTUBE HARI INI</span>
        <span className="text-ink">
          {nf.format(quota.used)} / {nf.format(DAILY_QUOTA)}
        </span>
      </div>
      <ProgressBar value={pct} tone={tone} label="Pemakaian kuota YouTube hari ini" />
      <p className={`mt-2 text-xs ${low ? 'text-amber' : 'text-ink-muted'}`}>
        {low
          ? `Kuota habis. Antrean berhenti dan lanjut otomatis setelah reset (${untilReset(quota.resetAt)} lagi).`
          : `${quota.uploadsLeft} upload lagi hari ini. Reset dalam ${untilReset(quota.resetAt)}.`}
      </p>
    </div>
  )
}
