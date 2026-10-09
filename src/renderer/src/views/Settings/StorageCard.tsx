import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { FootageInfo } from '@shared/footage'
import { FOOTAGE_CAPS_GB, type Settings } from '@shared/settings'
import { errMsg } from '@/lib/errors'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import ConfirmButton from '@/ui/ConfirmButton'
import Select from '@/ui/Select'

const formatSize = (bytes: number): string => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`)

interface Props {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
}

/** Label dan tombol di satu baris, path di baris sendiri: tetap muat di kartu sempit. */
function FolderRow({ label, value, onPick, onReset }: { label: string; value: string | null; onPick: () => void; onReset: () => void }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
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
  const [footage, setFootage] = useState<FootageInfo | null>(null)
  const refresh = useCallback(() => void window.youfarm.footage.stats().then(setFootage), [])
  // Lokasi pustaka mengikuti folder impor, jadi ringkasannya dimuat ulang saat folder berganti.
  useEffect(refresh, [refresh, settings.importDir])

  const pick = async (key: 'importDir' | 'outputDir') => {
    const dir = await window.youfarm.dialog.selectFolder()
    if (dir) onUpdate({ [key]: dir })
  }

  const clear = async () => {
    try {
      setFootage(await window.youfarm.footage.clear())
      toast.success('Pustaka footage dikosongkan.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mengosongkan pustaka.'))
    }
  }

  const caps = (FOOTAGE_CAPS_GB as readonly number[]).includes(settings.footageCapGb) ? [...FOOTAGE_CAPS_GB] : [...FOOTAGE_CAPS_GB, settings.footageCapGb].sort((a, b) => a - b)

  return (
    <Card title="Penyimpanan" description="Lokasi file sumber dan hasil render.">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <FolderRow label="Folder impor" value={settings.importDir} onPick={() => void pick('importDir')} onReset={() => onUpdate({ importDir: null })} />
        <FolderRow label="Folder hasil" value={settings.outputDir} onPick={() => void pick('outputDir')} onReset={() => onUpdate({ outputDir: null })} />

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-t border-line pt-5">
          <div className="grid gap-1">
            <span className="text-xs text-ink-muted">Pustaka footage</span>
            <p className="text-sm text-ink-muted">
              Klip stock yang diunduh disimpan di folder impor, satu subfolder per penyedia (mis. <span className="font-mono text-ink">pixabay</span>), lalu dipakai ulang bila cocok. Klip yang baru dipakai dihindari supaya video tidak monoton.
            </p>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="tabular font-mono">{footage ? `${footage.count} klip · ${formatSize(footage.bytes)}` : 'Memuat…'}</div>
              {footage && (
                <div className="truncate font-mono text-xs text-ink-muted" title={footage.root}>
                  {footage.root}
                </div>
              )}
            </div>
            <ConfirmButton size="sm" confirmLabel="Yakin kosongkan?" disabled={!footage || footage.count === 0} onConfirm={() => void clear()}>
              Kosongkan
            </ConfirmButton>
          </div>
          <Select label="Batas ukuran pustaka" value={String(settings.footageCapGb)} onChange={(e) => onUpdate({ footageCapGb: Number(e.target.value) })}>
            {caps.map((gb) => (
              <option key={gb} value={gb}>
                {gb} GB
              </option>
            ))}
          </Select>
          <p className="text-xs text-ink-muted">Lewat batas ini, klip yang paling lama tidak dipakai dihapus setelah video jadi. Mengosongkan hanya menghapus klip yang tercatat di pustaka, bukan berkas lain di folder.</p>
        </div>
      </div>
    </Card>
  )
}
