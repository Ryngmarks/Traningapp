import { type FormEvent, useState } from 'react'
import { signInWithPassword } from '@/data/auth'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'

/**
 * Sign in only. There is no sign-up: accounts are created by the owner in the
 * Supabase dashboard (docs/SECURITY.md).
 */
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggningen misslyckades.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 pt-safe pb-safe">
      <div className="mx-auto w-full max-w-sm animate-slide-up">
        <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="mb-8 size-14 rounded-2xl ring-1 ring-line" />
        <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.03em]">Träning</h1>
        <p className="mt-2 text-[15px] text-muted">Logga in för att fortsätta.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Field label="E-post">
            {(id) => <TextInput id={id} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Lösenord">
            {(id) => <TextInput id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={!email || !password}>Logga in</Button>
        </form>
      </div>
    </div>
  )
}

export function ConfigMissingScreen() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">Konfiguration saknas</h1>
        <p className="mt-3 text-muted">
          Ange <code className="text-fg">VITE_SUPABASE_URL</code> och <code className="text-fg">VITE_SUPABASE_ANON_KEY</code> i
          <code className="text-fg"> .env.local</code> (se README).
        </p>
      </div>
    </div>
  )
}
