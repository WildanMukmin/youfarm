import type { Settings } from '@shared/settings'
import Card from '@/ui/Card'
import Segmented from '@/ui/Segmented'

interface Props {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
}

export default function AppearanceCard({ settings, onUpdate }: Props) {
  return (
    <Card title="Tampilan">
      <div className="grid gap-1.5">
        <Segmented
          label="Tema"
          value={settings.theme}
          onChange={(theme) => onUpdate({ theme })}
          options={[
            { value: 'dark', label: 'Gelap' },
            { value: 'light', label: 'Terang', disabled: true, title: 'Belum tersedia' },
            { value: 'system', label: 'Ikuti sistem', disabled: true, title: 'Belum tersedia' }
          ]}
        />
        <p className="text-xs text-ink-muted">Tema terang dan ikuti sistem menyusul.</p>
      </div>
    </Card>
  )
}
