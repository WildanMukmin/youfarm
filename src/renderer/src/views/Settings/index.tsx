import { useState } from 'react'
import { useSettings } from '@/hooks/useSettings'
import PageHeader from '@/ui/PageHeader'
import Tabs, { type TabItem } from '@/ui/Tabs'
import ApiKeysCard from './ApiKeysCard'
import AppearanceCard from './AppearanceCard'
import ProvidersCard from './ProvidersCard'
import StorageCard from './StorageCard'

type TabId = 'general' | 'api'

const TABS: TabItem<TabId>[] = [
  { id: 'general', label: 'Umum' },
  { id: 'api', label: 'API' }
]

export default function SettingsView() {
  const { settings, status, update, changeSecrets } = useSettings()
  const [tab, setTab] = useState<TabId>('general')

  return (
    <section className="mx-auto max-w-3xl p-8 pb-16">
      <PageHeader title="Settings" subtitle="Pengaturan umum. Opsi teknis ada di tiap mode." />
      {settings && status ? (
        <Tabs tabs={TABS} active={tab} onChange={setTab}>
          <div className="grid gap-5">
            {tab === 'general' && (
              <>
                <StorageCard settings={settings} onUpdate={(p) => void update(p)} />
                <AppearanceCard settings={settings} onUpdate={(p) => void update(p)} />
              </>
            )}
            {tab === 'api' && (
              <>
                <ApiKeysCard status={status} onChange={(s) => void changeSecrets(s)} />
                <ProvidersCard settings={settings} status={status} onUpdate={(p) => void update(p)} />
              </>
            )}
          </div>
        </Tabs>
      ) : (
        <p className="text-ink-muted">Memuat…</p>
      )}
    </section>
  )
}
