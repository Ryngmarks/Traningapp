import { type FormEvent, useState } from 'react'
import { updatePassword, useUserId } from '@/data/auth'
import { toDataError } from '@/data/errors'
import { useUpdateProfile } from '@/data/profile'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'

const MIN_LENGTH = 12

/**
 * Shown after opening an invite or password-reset link: the member chooses a
 * password (and on invite, the name friends will see on shared passes).
 */
export function SetPasswordScreen({ invite, onDone }: { invite: boolean; onDone: () => void }) {
  const userId = useUserId()
  const profile = useUpdateProfile()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_LENGTH) return setError(`Lösenordet måste ha minst ${MIN_LENGTH} tecken.`)
    if (password !== repeat) return setError('Lösenorden matchar inte.')
    setLoading(true)
    setError(null)
    try {
      await updatePassword(password)
      if (invite && name.trim() && userId) await profile.mutateAsync({ id: userId, display_name: name.trim() })
      window.history.replaceState(null, '', window.location.pathname)
      onDone()
    } catch (err) {
      setError(toDataError(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 pt-safe pb-safe">
      <div className="mx-auto w-full max-w-sm animate-slide-up">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em]">
          {invite ? 'Välkommen!' : 'Nytt lösenord'}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {invite ? 'Välj ditt namn och ett lösenord för att komma igång.' : 'Välj ett nytt lösenord.'}
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          {invite && (
            <Field label="Ditt namn" hint="Visas för dina vänner på pass och övningar du delar.">
              {(id) => <TextInput id={id} autoComplete="given-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
          )}
          <Field label="Lösenord" hint={`Minst ${MIN_LENGTH} tecken.`}>
            {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Upprepa lösenord">
            {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
          </Field>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={!password || !repeat}>
            Spara och fortsätt
          </Button>
        </form>
      </div>
    </div>
  )
}
