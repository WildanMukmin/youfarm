import { KeyRound, SlidersHorizontal } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useStickyState } from '@/hooks/useStickyState'
import Workspace from '@/layout/Workspace'
import PanelTabs from '@/ui/PanelTabs'
import ScrollArea from '@/ui/ScrollArea'
import ApiKeysCard from './ApiKeysCard'
import AppearanceCard from './AppearanceCard'
import ProvidersCard from './ProvidersCard'
import StorageCard from './StorageCard'

type TabId = 'general' | 'api'

export default function SettingsView() {
  const { settings, status, update, changeSecrets } = useSettings()
  const [tab, setTab] = useStickyState<TabId>('settings:tab', 'general')

  return (
    <Workspace
      title="Settings"
      subtitle="Pengaturan umum. Opsi teknis (suara, caption, render) ada di tiap mode."
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
        {settings && status ? (
          <div className="mx-auto grid max-w-6xl items-start gap-5 lg:grid-cols-2">
            {tab === 'general' ? (
              <>
                <StorageCard settings={settings} onUpdate={(p) => void update(p)} />
                <AppearanceCard settings={settings} onUpdate={(p) => void update(p)} />
              </>
            ) : (
              <>
                <ApiKeysCard status={status} onChange={(s) => void changeSecrets(s)} />
                <ProvidersCard settings={settings} status={status} onUpdate={(p) => void update(p)} />
              </>
            )}
          </div>
        ) : (
          <p className="text-ink-muted">Memuat…</p>
        )}
      </ScrollArea>
    </Workspace>
  )
}
