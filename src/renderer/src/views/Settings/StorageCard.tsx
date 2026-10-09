import type { Settings } from '@shared/settings'
import Button from '@/ui/Button'
import Card from '@/ui/Card'

interface Props {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
}

function FolderRow({ label, value, onPick, onReset }: { label: string; value: string | null; onPick: () => void; onReset: () => void }) {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="truncate font-mono text-sm" title={value ?? undefined}>
          {value ?? 'Belum dipilih (memakai folder bawaan)'}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onPick}>
          Pilih folder
        </Button>
        {value && (
          <Button variant="ghost" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}

export default function StorageCard({ settings, onUpdate }: Props) {
  const pick = async (key: 'importDir' | 'outputDir') => {
    const dir = await window.youfarm.dialog.selectFolder()
    if (dir) onUpdate({ [key]: dir })
  }
  return (
    <Card title="Penyimpanan" description="Lokasi file sumber dan hasil render.">
      <div className="grid gap-4">
        <FolderRow label="Folder impor" value={settings.importDir} onPick={() => void pick('importDir')} onReset={() => onUpdate({ importDir: null })} />
        <FolderRow label="Folder hasil" value={settings.outputDir} onPick={() => void pick('outputDir')} onReset={() => onUpdate({ outputDir: null })} />
      </div>
    </Card>
  )
}
