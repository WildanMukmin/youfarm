import { useState } from 'react'
import type { YoutubeAccountStatus } from '@shared/youtube/accounts'
import Button from '@/ui/Button'
import ConfirmButton from '@/ui/ConfirmButton'
import Field from '@/ui/Field'
import Panel from '@/ui/Panel'

interface Props {
  status: YoutubeAccountStatus
  onSave: (clientId: string, clientSecret: string) => Promise<boolean>
  onClear: () => void
}

const STEPS = [
  'Buka console.cloud.google.com, buat project baru.',
  'APIs & Services > Library: aktifkan YouTube Data API v3 dan YouTube Analytics API.',
  'OAuth consent screen: External, tambahkan email Anda sebagai Test user.',
  'Credentials > Create credentials > OAuth client ID, jenis: Desktop app.',
  'Salin Client ID dan Client Secret ke sini.'
]

/** Panel kiri halaman Akun: kredensial app Google Cloud milik pengguna. */
export default function CredentialsPanel({ status, onSave, onClear }: Props) {
  const [editing, setEditing] = useState(!status.hasCredentials)
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const showForm = editing || !status.hasCredentials

  const save = async () => {
    if (await onSave(clientId, secret)) {
      setClientId('')
      setSecret('')
      setEditing(false)
    }
  }

  return (
    <Panel
      title="Kredensial Google"
      footer={
        showForm ? (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!clientId.trim() || !secret.trim()} onClick={() => void save()}>
              Simpan
            </Button>
            {status.hasCredentials && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Batal
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setEditing(true)}>
              Ganti
            </Button>
            <ConfirmButton confirmLabel="Hapus semua?" onConfirm={onClear}>
              Hapus
            </ConfirmButton>
          </div>
        )
      }
    >
      <div className="grid gap-4">
        <p className="text-xs text-ink-muted">App developer Google Cloud milik Anda sendiri, jadi kuota dan izinnya tidak dibagi dengan orang lain.</p>

        {showForm ? (
          <>
            <Field label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234-abc.apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
            <Field label="Client Secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="GOCSPX-…" autoComplete="off" />
            {status.hasCredentials && <p className="text-xs text-amber">Mengganti Client ID menghapus semua channel yang terhubung.</p>}
          </>
        ) : (
          <div className="grid gap-1">
            <span className="text-xs text-ink-muted">Client ID</span>
            <span className="break-all font-mono text-xs">{status.clientId}</span>
            <span className="mt-1 text-xs text-ink-muted">Client Secret tersimpan terenkripsi.</span>
          </div>
        )}

        <details className="rounded-sm border border-line-hi p-3 text-xs" open={!status.hasCredentials}>
          <summary className="cursor-pointer font-medium">Cara mendapatkan Client ID</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-ink-muted">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-ink-muted">Selama app berstatus Testing, token kedaluwarsa tiap 7 hari dan channel perlu dihubungkan ulang.</p>
        </details>
      </div>
    </Panel>
  )
}
