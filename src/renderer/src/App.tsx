import { useEffect, useState, type ComponentType } from 'react'
import { Toaster } from 'sonner'
import type { ModeId } from '@shared/contracts/modes'
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

/** `editor`: halaman mengatur tinggi dan scroll sendiri (panel). Selain itu halaman di-scroll utuh. */
const VIEWS: Record<ViewId, { component: ComponentType<ViewProps>; editor: boolean }> = {
  'fakta-unik': { component: FaktaUnikWorkspace, editor: true },
  'alur-cerita': { component: comingSoon('alur-cerita'), editor: true },
  'animasi-3d': { component: comingSoon('animasi-3d'), editor: true },
  kids: { component: comingSoon('kids'), editor: true },
  'asmr-konstruksi': { component: comingSoon('asmr-konstruksi'), editor: true },
  'bedah-konten': { component: comingSoon('bedah-konten'), editor: true },
  queue: { component: QueueView, editor: false },
  library: { component: LibraryView, editor: false },
  analytics: { component: AnalyticsView, editor: false },
  accounts: { component: AccountsView, editor: true },
  settings: { component: SettingsView, editor: false }
}

export default function App() {
  const [view, setView] = useState<ViewId>('fakta-unik')
  const [version, setVersion] = useState('')
  const { component: View, editor } = VIEWS[view]

  useEffect(() => {
    void window.youfarm?.appInfo().then((i) => setVersion(`v${i.version}`))
  }, [])

  return (
    <div className="flex h-full">
      <Sidebar active={view} onSelect={setView} version={version} />
      <main className={`relative min-w-0 flex-1 ${editor ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <View onNavigate={setView} />
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}
