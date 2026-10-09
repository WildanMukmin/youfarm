import {
  Baby,
  Box,
  ChartColumn,
  Clapperboard,
  Hammer,
  Library,
  Lightbulb,
  ListOrdered,
  ScanSearch,
  Settings,
  UserRound,
  type LucideIcon
} from 'lucide-react'
import { MODE_INFO, type ModeId } from '@shared/contracts/modes'
import mark from '@assets/brand/logo/youfarm-mark.svg'
import type { ViewId } from './views'

const MODE_ICON: Record<ModeId, { icon: LucideIcon; short: string }> = {
  'fakta-unik': { icon: Lightbulb, short: 'Fakta' },
  'alur-cerita': { icon: Clapperboard, short: 'Cerita' },
  'animasi-3d': { icon: Box, short: 'Animasi' },
  kids: { icon: Baby, short: 'Kids' },
  'asmr-konstruksi': { icon: Hammer, short: 'ASMR' },
  'bedah-konten': { icon: ScanSearch, short: 'Bedah' }
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
}

function Item({ on, label, title, icon: Icon, muted, onClick }: { on: boolean; label: string; title: string; icon: LucideIcon; muted?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-current={on ? 'page' : undefined}
      className={
        'grid w-14 justify-items-center gap-0.5 rounded-sm border py-1.5 text-[10px] transition-colors ' +
        (on ? 'border-crimson-dim bg-panel-2 text-crimson-hi shadow-glow' : 'border-transparent text-ink-muted hover:text-ink') +
        (muted && !on ? ' opacity-60' : '')
      }
    >
      <Icon size={19} strokeWidth={1.7} />
      {label}
    </button>
  )
}

export default function Sidebar({ active, onSelect, version }: Props) {
  return (
    <nav aria-label="Menu utama" className="flex w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-panel py-3">
      <img src={mark} alt="YouFarm" className="mb-2 h-9 w-9" />

      <span className="mt-1 font-mono text-[9px] uppercase tracking-widest text-ink-muted">Mode</span>
      {MODE_INFO.map((m) => (
        <Item
          key={m.id}
          on={active === m.id}
          label={MODE_ICON[m.id].short}
          title={m.available ? m.label : `${m.label} (segera)`}
          icon={MODE_ICON[m.id].icon}
          muted={!m.available}
          onClick={() => onSelect(m.id)}
        />
      ))}

      <div className="my-2 h-px w-10 shrink-0 bg-line-hi" />

      {TOOLS.map((t) => (
        <Item key={t.id} on={active === t.id} label={t.label} title={t.label} icon={t.icon} onClick={() => onSelect(t.id)} />
      ))}

      <span className="mt-auto pt-3 font-mono text-[9px] text-ink-muted">{version}</span>
    </nav>
  )
}
