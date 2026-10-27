import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { signOut, updatePassword, useSession } from '@/data/auth'
import { type Profile, useProfile, useUpdateProfile } from '@/data/profile'
import { useHistoricalTotals } from '@/data/totals'
import { Button } from '@/ui/Button'
import { Card, LinkCard, SectionTitle } from '@/ui/Card'
import { ChipGroup, Field, Select, TextInput } from '@/ui/Field'
import { Icon, type IconName } from '@/ui/Icon'
import { Screen, SubHeader } from '@/ui/Page'
import { ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { passwordError, timezoneLabel, timezoneOptions, WEIGHT_INCREMENTS } from './helpers'

const INCREMENT_OPTIONS = WEIGHT_INCREMENTS.map((v) => ({ value: v, label: `${String(v).replace('.', ',')} kg` }))

export function SettingsScreen() {
  const profile = useProfile()
  // useProfile().data is inferred as `null` from unwrap() on .single(); the row is a Profile.
  const data = profile.data as Profile | null | undefined

  return (
    <Screen>
      <SubHeader title="Inställningar" back="/" />

      <SectionTitle>Profil</SectionTitle>
      {profile.isPending ? (
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
      ) : profile.error || !data ? (
        <ErrorState error={profile.error ?? new Error('Profilen hittades inte.')} onRetry={() => profile.refetch()} />
      ) : (
        <ProfileForm key={data.updated_at} profile={data} />
      )}

      <SectionTitle>Data</SectionTitle>
      <div className="space-y-2.5">
        <DataLink to="/installningar/historik" icon="history" title="Historiska totaler" sub={<TotalsCount />} />
        <DataLink to="/installningar/import" icon="upload" title="Importera aktiviteter" sub="CSV eller JSON" />
      </div>

      <Account />
    </Screen>
  )
}

function DataLink({ to, icon, title, sub }: { to: string; icon: IconName; title: string; sub: ReactNode }) {
  return (
    <LinkCard to={to}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-raised text-muted ring-1 ring-line">
          <Icon name={icon} size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{title}</div>
          <div className="truncate text-[13px] text-muted">{sub}</div>
        </div>
      </div>
    </LinkCard>
  )
}

function TotalsCount() {
  const { data } = useHistoricalTotals()
  if (!data || data.length === 0) return <>Pass från före appen</>
  return <>{data.length} {data.length === 1 ? 'total' : 'totaler'}</>
}

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const toast = useToast()
  const [name, setName] = useState(profile.display_name ?? '')
  const [tz, setTz] = useState(profile.timezone)
  const [inc, setInc] = useState(profile.weight_increment_kg)
  const zones = useMemo(() => timezoneOptions(profile.timezone), [profile.timezone])

  const dirty = name.trim() !== (profile.display_name ?? '') || tz !== profile.timezone || inc !== profile.weight_increment_kg
  const nameError = name.trim().length > 80 ? 'Högst 80 tecken' : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (nameError || !dirty) return
    update.mutate(
      { id: profile.id, display_name: name.trim() || null, timezone: tz, weight_increment_kg: inc },
      {
        onSuccess: () => toast('Sparat'),
        onError: (err) => toast(err.message, { tone: 'error' }),
      },
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="Namn" error={nameError}>
          {(fid) => (
            <TextInput id={fid} value={name} autoComplete="given-name" placeholder="Ditt namn" maxLength={80}
              invalid={Boolean(nameError)} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label="Tidszon" hint="Används för datum i statistiken.">
          {(fid) => (
            <Select id={fid} value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{timezoneLabel(z)}</option>)}
            </Select>
          )}
        </Field>
        <div className="space-y-1.5">
          <div className="px-0.5 text-[13px] font-medium text-muted">Viktökning</div>
          <ChipGroup label="Viktökning" value={inc} onChange={setInc} options={INCREMENT_OPTIONS} />
          <p className="px-0.5 text-[12px] text-faint">Steget som föreslås när du ska öka vikten.</p>
        </div>
        <Button type="submit" variant={dirty ? 'primary' : 'secondary'} block disabled={!dirty} loading={update.isPending}>
          {dirty ? 'Spara' : 'Sparat'}
        </Button>
      </form>
    </Card>
  )
}

function Account() {
  const session = useSession()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    const err = passwordError(pw, confirm)
    if (err) { setError(err); return }
    setError(null)
    setSaving(true)
    try {
      await updatePassword(pw)
      toast('Lösenordet är bytt')
      setPw(''); setConfirm(''); setOpen(false)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Kunde inte byta lösenord.')
    } finally {
      setSaving(false)
    }
  }

  async function onSignOut() {
    setLeaving(true)
    try {
      await signOut()
    } catch (ex) {
      setLeaving(false)
      toast(ex instanceof Error ? ex.message : 'Kunde inte logga ut.', { tone: 'error' })
    }
  }

  return (
    <>
      <SectionTitle>Konto</SectionTitle>
      <Card className="p-0">
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-muted">Inloggad som</div>
            <div className="truncate text-[15px]">{session?.user.email ?? '–'}</div>
          </div>
        </div>
        <div className="border-t border-line/70">
          <button type="button" aria-expanded={open} onClick={() => { setOpen((o) => !o); setError(null) }}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-medium">
            <span className="flex-1">Byt lösenord</span>
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} className="text-faint" />
          </button>
          {open && (
            <form onSubmit={onChangePassword} noValidate className="space-y-4 px-4 pb-4 animate-fade-in">
              <Field label="Nytt lösenord" error={error}>
                {(fid) => (
                  <TextInput id={fid} type="password" autoComplete="new-password" value={pw} invalid={Boolean(error)}
                    onChange={(e) => setPw(e.target.value)} />
                )}
              </Field>
              <Field label="Upprepa lösenord">
                {(fid) => (
                  <TextInput id={fid} type="password" autoComplete="new-password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} />
                )}
              </Field>
              <Button type="submit" variant="primary" block loading={saving}>Byt lösenord</Button>
            </form>
          )}
        </div>
      </Card>

      <Button className="mt-6" block variant="ghost" icon="logout" loading={leaving} onClick={onSignOut}>Logga ut</Button>
    </>
  )
}
