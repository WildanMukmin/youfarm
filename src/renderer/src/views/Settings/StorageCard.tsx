import type { Settings } from '@shared/settings'
import Button from '@/ui/Button'
import Card from '@/ui/Card'

interface Props {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
}

/** Label dan tombol di satu baris, path di baris sendiri: tetap muat di kartu sempit. */
function FolderRow({ label, value, onPick, onReset }: { label: string; value: string | null; onPick: () => void; onReset: () => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">{label}</span>
        <div className="flex shrink-0 gap-2">
          {value && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onPick}>
            Pilih folder
          </Button>
        </div>
      </div>
      {value ? (
        <div className="truncate font-mono text-sm" title={value}>
          {value}
        </div>
      ) : (
        <div className="text-sm text-ink-muted">Belum dipilih. Memakai folder bawaan.</div>
      )}
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
      <div className="grid gap-5">
        <FolderRow label="Folder impor" value={settings.importDir} onPick={() => void pick('importDir')} onReset={() => onUpdate({ importDir: null })} />
        <FolderRow label="Folder hasil" value={settings.outputDir} onPick={() => void pick('outputDir')} onReset={() => onUpdate({ outputDir: null })} />
      </div>
    </Card>
  )
}
