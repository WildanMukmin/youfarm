import { DAILY_QUOTA, QUOTA_COST } from '@shared/youtube/quota'
import type { QuotaSnapshot } from '@shared/youtube/queue'

function untilReset(resetAt: string): string {
  const ms = Math.max(0, new Date(resetAt).getTime() - Date.now())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} j ${m} mnt` : `${m} mnt`
}

const nf = new Intl.NumberFormat('id-ID')

/**
 * Kuota harian YouTube sebagai tile meter. Isi bar membawa tingkat (crimson → amber → habis),
 * treknya versi muda dari warna yang sama, dan statusnya selalu tertulis, bukan hanya warna.
 */
export default function QuotaMeter({ quota }: { quota: QuotaSnapshot }) {
  const pct = Math.min(100, (quota.used / DAILY_QUOTA) * 100)
  const out = quota.remaining < QUOTA_COST.videoUpload
  const low = !out && quota.uploadsLeft <= 1
  const fill = out ? 'bg-err' : low ? 'bg-amber' : 'bg-crimson'
  const track = out ? 'bg-err/15' : low ? 'bg-amber/15' : 'bg-crimson/15'

  return (
    <div className="min-w-0 rounded-sm border border-line bg-panel px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 whitespace-nowrap text-xs text-ink-muted">
        <span className="truncate">Kuota hari ini</span>
        <span className="tabular shrink-0 font-mono text-ink">
          {nf.format(quota.used)} / {nf.format(DAILY_QUOTA)}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Pemakaian kuota YouTube hari ini"
        aria-valuemin={0}
        aria-valuemax={DAILY_QUOTA}
        aria-valuenow={quota.used}
        className={`mt-2.5 h-1.5 overflow-hidden rounded-full ${track}`}
      >
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-2 truncate text-[11px] ${out ? 'text-err' : low ? 'text-amber' : 'text-ink-muted'}`}>
        {out ? `Habis · lanjut ${untilReset(quota.resetAt)} lagi` : `Sisa ${quota.uploadsLeft} upload · reset ${untilReset(quota.resetAt)}`}
      </div>
    </div>
  )
}
