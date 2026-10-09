/**
 * Bungkus tiap metode klien: bila panggilan gagal karena key kena batas (kuota habis, atau batas per menit) dan
 * `onLimit` mengganti key, panggilan diulang dengan key baru. Berhenti bila tidak ada key lain yang siap.
 * Klien membaca key tiap permintaan, jadi pergantian langsung berlaku.
 */
export function withRotation<T extends object>(client: T, onLimit: (kind: 'quota' | 'rate') => boolean): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const member = Reflect.get(target, prop, receiver)
      if (typeof member !== 'function') return member
      return async (...args: unknown[]) => {
        for (;;) {
          try {
            return await member.apply(target, args)
          } catch (e) {
            const err = e as { kind?: string; limited?: boolean }
            if (err.kind !== 'quota' && !err.limited) throw e
            if (!onLimit(err.kind === 'quota' ? 'quota' : 'rate')) throw e
          }
        }
      }
    }
  })
}
