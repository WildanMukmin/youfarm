import { useCallback, useEffect, useState } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ApiKeyInfo, ApiKeysOverview } from '@shared/api-keys'
import { MAX_KEYS_PER_PROVIDER } from '@shared/api-keys'
import type { SecretKey, SecretStatus } from '@shared/settings'
import { useStickyState } from '@/hooks/useStickyState'
import { errMsg } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import Button from '@/ui/Button'
import Checkbox from '@/ui/Checkbox'
import Field from '@/ui/Field'
import IconButton, { IconGap } from '@/ui/IconButton'
import PanelTabs from '@/ui/PanelTabs'
import StatusChip from '@/ui/StatusChip'

const PROVIDERS: { id: SecretKey; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Gemini', hint: 'Naskah, saran topik, dan suara Gemini TTS. Key dari Google AI Studio.' },
  { id: 'groq', label: 'Groq', hint: 'Naskah dan saran topik (alternatif Gemini).' },
  { id: 'deepgram', label: 'Deepgram', hint: 'Suara narasi: Inggris dan 6 bahasa lain.' },
  { id: 'elevenlabs', label: 'ElevenLabs', hint: 'Suara narasi: 30-an bahasa, termasuk Indonesia. Paket gratis tidak untuk komersial.' },
  { id: 'pixabay', label: 'Pixabay', hint: 'Footage stock (utama).' },
  { id: 'pexels', label: 'Pexels', hint: 'Footage stock (alternatif).' }
]

const th = 'sticky top-0 whitespace-nowrap border-b border-line bg-panel px-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted'
const td = 'border-b border-line px-3 align-middle'

const clock = (iso: string | null): string => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')

function KeyStatus({ k, auto }: { k: ApiKeyInfo; auto: boolean }) {
  if (k.limited) return <StatusChip tone="warn">{`Batas · coba lagi ${clock(k.limitedUntil)}`}</StatusChip>
  if (k.active) return <StatusChip tone="done">Dipakai</StatusChip>
  return <StatusChip tone="idle">{auto ? 'Cadangan' : 'Siap'}</StatusChip>
}

interface Props {
  /** Dipanggil setiap daftar key berubah, supaya halaman lain tahu penyedia mana yang sudah punya key. */
  onStatus: (status: SecretStatus) => void
}

/** Tab API: satu sub-tab per penyedia, berisi tabel key (bisa lebih dari satu) dan pilihan ganti otomatis. */
export default function ApiKeysPanel({ onStatus }: Props) {
  const [provider, setProvider] = useStickyState<SecretKey>('settings:api-provider', 'gemini')
  const [overview, setOverview] = useState<ApiKeysOverview | null>(null)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = useCallback(
    (next: ApiKeysOverview) => {
      setOverview(next)
      onStatus(Object.fromEntries(PROVIDERS.map((p) => [p.id, next[p.id].keys.length > 0])) as SecretStatus)
    },
    [onStatus]
  )

  useEffect(() => {
    void window.youfarm.keys.overview().then(apply)
  }, [apply])

  const run = async (job: () => Promise<ApiKeysOverview>, done?: string): Promise<boolean> => {
    setBusy(true)
    try {
      apply(await job())
      if (done) toast.success(done)
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mengubah key.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const meta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]
  const group = overview?.[meta.id]
  const full = (group?.keys.length ?? 0) >= MAX_KEYS_PER_PROVIDER

  const add = async () => {
    if (await run(() => window.youfarm.keys.add(meta.id, label, value), 'Key disimpan terenkripsi.')) {
      setLabel('')
      setValue('')
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <div className="border-b border-line">
        <PanelTabs
          label="Penyedia API"
          active={provider}
          onChange={setProvider}
          tabs={PROVIDERS.map((p) => ({ id: p.id, label: p.label, count: overview?.[p.id].keys.length || undefined }))}
        />
      </div>

      <section className="grid min-w-0 gap-5 rounded-md border border-line bg-panel p-5" aria-label={`Key ${meta.label}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">{meta.label}</h2>
            <p className="mt-1 text-sm text-ink-muted">{meta.hint}</p>
          </div>
          <Checkbox
            className="max-w-xs"
            label="Ganti otomatis saat kena batas"
            hint="Bila key yang dipakai kena batas atau habis jatah, pindah ke key berikutnya di tabel."
            checked={group?.auto ?? true}
            disabled={busy || !group}
            onChange={(e) => void run(() => window.youfarm.keys.setAuto(meta.id, e.target.checked))}
          />
        </div>

        <form
          className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-end gap-3 max-[640px]:grid-cols-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim().length >= 8 && !full) void add()
          }}
        >
          <Field label="Nama (opsional)" value={label} maxLength={40} placeholder="mis. Akun utama" onChange={(e) => setLabel(e.target.value)} />
          <Field label={`Key ${meta.label}`} type="password" autoComplete="off" value={value} placeholder="Tempel key di sini" onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" className="h-[42px]" disabled={busy || full || value.trim().length < 8}>
            Tambah key
          </Button>
        </form>
        {full && <p className="-mt-3 text-xs text-ink-muted">Sudah {MAX_KEYS_PER_PROVIDER} key, batas maksimal. Hapus satu untuk menambah.</p>}

        {group && group.keys.length > 0 ? (
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col />
              <col className="w-[110px]" />
              <col className="w-[240px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead>
              <tr className="h-9">
                <th className={th}>Nama</th>
                <th className={th}>Key</th>
                <th className={th}>Status</th>
                <th className={th}>Ditambahkan</th>
                <th className={`${th} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {group.keys.map((k) => (
                <tr key={k.id} className={`h-[52px] ${k.active ? 'bg-panel-2 shadow-[inset_2px_0_0_var(--crimson)]' : 'hover:bg-panel-2'}`}>
                  <td className={td}>
                    <div className="truncate font-medium" title={k.label}>
                      {k.label}
                    </div>
                  </td>
                  <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{`••••${k.last4}`}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <KeyStatus k={k} auto={group.auto} />
                  </td>
                  <td className={`${td} tabular whitespace-nowrap font-mono text-xs text-ink-muted`}>{formatDate(k.addedAt)}</td>
                  <td className={td}>
                    <div className="flex justify-end gap-1.5">
                      {k.limited ? <IconButton icon={RotateCcw} label="Hapus tanda batas" disabled={busy} onClick={() => void run(() => window.youfarm.keys.resetLimit(meta.id, k.id))} /> : <IconGap />}
                      {k.active ? <IconGap /> : <IconButton icon={Check} label="Pakai key ini" disabled={busy} onClick={() => void run(() => window.youfarm.keys.select(meta.id, k.id))} />}
                      <IconButton
                        icon={Trash2}
                        label="Hapus key"
                        confirm={{ message: `Hapus key "${k.label}"? Key ini dihapus dari komputer dan tidak bisa dipulihkan.`, action: 'Hapus' }}
                        disabled={busy}
                        onClick={() => void run(() => window.youfarm.keys.remove(meta.id, k.id), 'Key dihapus.')}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-sm border border-dashed border-line-hi p-6 text-center text-sm text-ink-muted">{group ? `Belum ada key ${meta.label}. Tambahkan lewat formulir di atas.` : 'Memuat…'}</p>
        )}

        <p className="text-xs text-ink-muted">Key disimpan terenkripsi di komputer ini dan tidak pernah ditampilkan lagi; tabel hanya menunjukkan empat karakter terakhir.</p>
      </section>
    </div>
  )
}
