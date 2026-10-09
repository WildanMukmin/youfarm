import { KeyRound, SlidersHorizontal } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import PanelTabs from '@/ui/PanelTabs'
import ScrollArea from '@/ui/ScrollArea'
import ApiKeysPanel from './ApiKeysPanel'
import AppearanceCard from './AppearanceCard'
import StorageCard from './StorageCard'

type TabId = 'general' | 'api'

export default function SettingsView() {
  const { settings, status, update, changeSecrets } = useSettings()
  const [tab, setTab] = useStickyState<TabId>('settings:tab', 'general')

  return (
    <Workspace
      title="Settings"
      subtitle="Pengaturan umum dan API key. Pilihan AI, suara, caption, dan render ada di tiap mode."
      tabs={
        <PanelTabs
          variant="bar"
          label="Bagian pengaturan"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'general', label: 'Umum', icon: <SlidersHorizontal size={15} aria-hidden /> },
            { id: 'api', label: 'API', icon: <KeyRound size={15} aria-hidden /> }
          ]}
        />
      }
    >
      <ScrollArea className="p-6">
        {tab === 'api' ? (
          <ApiKeysPanel onStatus={changeSecrets} />
        ) : settings && status ? (
          <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-5">
            <StorageCard settings={settings} onUpdate={(p) => void update(p)} />
            <AppearanceCard settings={settings} onUpdate={(p) => void update(p)} />
          </div>
        ) : (
          <p className="text-ink-muted">Memuat…</p>
        )}
      </ScrollArea>
    </Workspace>
  )
}
