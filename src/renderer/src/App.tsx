import { useEffect, useState, type ComponentType } from 'react'
import { Toaster } from 'sonner'
import type { ModeId } from '@shared/contracts/modes'
import { useSidebar } from './hooks/useSidebar'
import Sidebar from './layout/Sidebar'
import type { ViewId, ViewProps } from './layout/views'
import FaktaUnikWorkspace from './modes/fakta-unik/FaktaUnikWorkspace'
import AccountsView from './views/Accounts'
import AnalyticsView from './views/Analytics'
import ComingSoon from './views/ComingSoon'
import LibraryView from './views/Library'
import QueueView from './views/Queue'
import SettingsView from './views/Settings'

const comingSoon = (mode: ModeId): ComponentType<ViewProps> =>
  function ModeComingSoon(p: ViewProps) {
    return <ComingSoon mode={mode} {...p} />
  }

/** Semua halaman memakai tata letak editor (tinggi = jendela, tanpa scroll halaman). */
const VIEWS: Record<ViewId, ComponentType<ViewProps>> = {
  'fakta-unik': FaktaUnikWorkspace,
  'alur-cerita': comingSoon('alur-cerita'),
  'animasi-3d': comingSoon('animasi-3d'),
  kids: comingSoon('kids'),
  'asmr-konstruksi': comingSoon('asmr-konstruksi'),
  'bedah-konten': comingSoon('bedah-konten'),
  queue: QueueView,
  library: LibraryView,
  analytics: AnalyticsView,
  accounts: AccountsView,
  settings: SettingsView
}

export default function App() {
  const [view, setView] = useState<ViewId>('fakta-unik')
  const [version, setVersion] = useState('')
  const sidebar = useSidebar()
  const View = VIEWS[view]

  useEffect(() => {
    void window.youfarm?.appInfo().then((i) => setVersion(`v${i.version}`))
  }, [])

  return (
    <div className="flex h-full">
      <Sidebar active={view} onSelect={setView} version={version} collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      <main className="relative min-w-0 flex-1 overflow-hidden">
        <View onNavigate={setView} />
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}
