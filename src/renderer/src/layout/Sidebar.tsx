import {
  Baby,
  Box,
  ChartColumn,
  Clapperboard,
  Hammer,
  Library,
  Lightbulb,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  Settings,
  UserRound,
  type LucideIcon
} from 'lucide-react'
import { MODE_INFO, type ModeId } from '@shared/contracts/modes'
import { needsAttention } from '@shared/youtube/queue'
import mark from '@assets/brand/logo/youfarm-mark.svg'
import { useQueue } from '@/hooks/useQueue'
import type { ViewId } from './views'

const MODE_ICON: Record<ModeId, LucideIcon> = {
  'fakta-unik': Lightbulb,
  'alur-cerita': Clapperboard,
  'animasi-3d': Box,
  kids: Baby,
  'asmr-konstruksi': Hammer,
  'bedah-konten': ScanSearch
}

const TOOLS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'queue', label: 'Antrean', icon: ListOrdered },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'analytics', label: 'Analitik', icon: ChartColumn },
  { id: 'accounts', label: 'Akun', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings }
]

interface Props {
  active: ViewId
  onSelect: (id: ViewId) => void
  version: string
  collapsed: boolean
  onToggle: () => void
}

interface Badge {
  value: number
  tone: 'alert' | 'neutral'
}

interface ItemProps {
  on: boolean
  label: string
  icon: LucideIcon
  collapsed: boolean
  onClick: () => void
  soon?: boolean
  badge?: Badge | null
}

/** Satu baris navigasi. Saat diciutkan hanya ikon, dengan tooltip di kanan. */
function Item({ on, label, icon: Icon, collapsed, onClick, soon, badge }: ItemProps) {
  const tip = soon ? `${label} · segera` : badge ? `${label} · ${badge.value}${badge.tone === 'alert' ? ' perlu perhatian' : ' aktif'}` : label
  return (
    <button
      onClick={onClick}
      aria-label={tip}
      aria-current={on ? 'page' : undefined}
      className={
        'group relative flex h-9 w-full shrink-0 items-center gap-3 rounded-sm px-2.5 text-sm transition-colors ' +
        (on ? 'bg-panel-2 text-ink' : 'text-ink-muted hover:bg-panel-2/60 hover:text-ink')
      }
    >
      {on && <span aria-hidden className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded-full bg-crimson shadow-[0_0_8px_var(--crimson)]" />}
      <span className="relative shrink-0">
        <Icon size={18} strokeWidth={1.8} className={on ? 'text-crimson-hi' : soon ? 'opacity-50' : ''} />
        {collapsed && badge && (
          <span
            aria-hidden
            className={`tabular absolute -right-2 -top-1.5 min-w-4 rounded-full px-1 text-center font-mono text-[9px] leading-4 ${badge.tone === 'alert' ? 'bg-err text-bg' : 'bg-line-hi text-ink'}`}
          >
            {badge.value > 9 ? '9+' : badge.value}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className={`min-w-0 flex-1 truncate text-left ${soon ? 'opacity-60' : ''}`}>{label}</span>
          {soon && <span className="text-[10px] text-ink-muted/70">segera</span>}
          {badge && (
            <span className={`tabular rounded-full px-1.5 font-mono text-[10px] leading-4 ${badge.tone === 'alert' ? 'bg-err/20 text-err' : 'bg-panel-2 text-ink-muted'}`}>
              {badge.value}
            </span>
          )}
        </>
      )}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-sm border border-line-hi bg-panel-2 px-2.5 py-1 text-xs text-ink opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {tip}
        </span>
      )}
    </button>
  )
}

function Section({ label, collapsed }: { label: string; collapsed: boolean }) {
  return collapsed ? (
    <div aria-hidden className="mx-auto my-2 h-px w-6 shrink-0 bg-line-hi" />
  ) : (
    <div className="mb-1 mt-4 shrink-0 px-2.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted/80">{label}</div>
  )
}

export default function Sidebar({ active, onSelect, version, collapsed, onToggle }: Props) {
  const { snapshot } = useQueue()
  const items = snapshot?.items ?? []
  const attention = items.filter(needsAttention).length
  const pending = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  const queueBadge: Badge | null = attention ? { value: attention, tone: 'alert' } : pending ? { value: pending, tone: 'neutral' } : null

  return (
    <nav
      aria-label="Menu utama"
      className={`relative z-20 flex shrink-0 flex-col border-r border-line bg-panel px-2 py-3 transition-[width] duration-200 ${collapsed ? 'w-[60px]' : 'w-[212px]'}`}
    >
      <div className={`flex h-10 shrink-0 items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-1.5'}`}>
        <img src={mark} alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-wide">
            You<span className="text-crimson-hi">Farm</span>
          </span>
        )}
      </div>

      <Section label="Mode" collapsed={collapsed} />
      <div className="grid gap-0.5">
        {MODE_INFO.map((m) => (
          <Item key={m.id} on={active === m.id} label={m.label} icon={MODE_ICON[m.id]} collapsed={collapsed} soon={!m.available} onClick={() => onSelect(m.id)} />
        ))}
      </div>

      <Section label="Alat" collapsed={collapsed} />
      <div className="grid gap-0.5">
        {TOOLS.map((t) => (
          <Item key={t.id} on={active === t.id} label={t.label} icon={t.icon} collapsed={collapsed} badge={t.id === 'queue' ? queueBadge : null} onClick={() => onSelect(t.id)} />
        ))}
      </div>

      <div className="mt-auto grid gap-1 pt-3">
        <Item on={false} label={collapsed ? 'Buka menu (Ctrl+B)' : 'Ciutkan menu'} icon={collapsed ? PanelLeftOpen : PanelLeftClose} collapsed={collapsed} onClick={onToggle} />
        {!collapsed && <span className="px-2.5 font-mono text-[10px] text-ink-muted/70">{version}</span>}
      </div>
    </nav>
  )
}
