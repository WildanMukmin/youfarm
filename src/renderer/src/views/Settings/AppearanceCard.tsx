import type { Settings } from '@shared/settings'
import Card from '@/ui/Card'
import RadioGroup from '@/ui/RadioGroup'

interface Props {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
}

export default function AppearanceCard({ settings, onUpdate }: Props) {
  return (
    <Card title="Tampilan">
      <RadioGroup
        legend="Tema"
        value={settings.theme}
        onChange={(theme) => onUpdate({ theme })}
        options={[
          { value: 'dark', label: 'Gelap', hint: 'Bawaan' },
          { value: 'light', label: 'Terang', disabled: true, disabledReason: 'Belum tersedia' },
          { value: 'system', label: 'Ikuti sistem', disabled: true, disabledReason: 'Belum tersedia' }
        ]}
      />
    </Card>
  )
}
