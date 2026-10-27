import { type FormEvent, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { type ActivityRow, useActivities, useSaveActivity } from '@/data/activities'
import { deviceTimezone } from '@/data/profile'
import { formatPace, paceSecondsPerKm } from '@/domain/format'
import { ACTIVITY_TYPES, type ActivityType } from '@/domain/types'
import { activityInputSchema, parseNumberInput } from '@/domain/validation'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { cn } from '@/ui/cn'
import { ChipGroup, Field, TextArea, TextInput } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Screen, SubHeader } from '@/ui/Page'
import { EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { todayLocal, useNow } from '@/ui/useNow'
import { durationToInput, parseDurationInput, zonedIso, zonedParts } from './helpers'
import { useGoBack } from './useGoBack'

type FormType = Exclude<ActivityType, 'gym'>

const TYPE_OPTIONS: readonly { value: FormType; label: string }[] = [
  { value: 'football_training', label: 'Fotbollsträning' },
  { value: 'football_match', label: 'Match' },
  { value: 'run', label: 'Löpning' },
  { value: 'walk', label: 'Promenad' },
  { value: 'other', label: 'Övrigt' },
]
const DURATION_CHIPS = [30, 45, 60, 75, 90] as const
const DEFAULT_DURATION_MIN: Record<FormType, number> = {
  football_training: 90, football_match: 90, run: 30, walk: 45, other: 60,
}
const RPE_HINT = ['', 'Mycket lätt', 'Mycket lätt', 'Lätt', 'Lätt', 'Måttlig', 'Måttlig', 'Hård', 'Hård', 'Mycket hård', 'Max']

const SHOWN_ERRORS = new Set(['started_at', 'duration_s', 'distance_m', 'steps', 'avg_heart_rate', 'perceived_exertion', 'notes'])

const isFormType = (t: string | null): t is FormType =>
  t != null && t !== 'gym' && (ACTIVITY_TYPES as readonly string[]).includes(t)

export function ActivityFormScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const activities = useActivities()

  if (!id) {
    const typ = params.get('typ')
    return <ActivityForm initialType={isFormType(typ) ? typ : 'run'} />
  }
  if (activities.isPending) {
    return <Screen><SubHeader title="Redigera" /><div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div></Screen>
  }
  if (activities.error) {
    return <Screen><SubHeader title="Redigera" /><ErrorState error={activities.error} onRetry={() => activities.refetch()} /></Screen>
  }
  const row = activities.data.find((a) => a.id === id)
  if (!row) {
    return <Screen><SubHeader title="Redigera" back="/aktivitet" /><EmptyState icon="search" title="Aktiviteten finns inte" text="Den kan ha tagits bort." /></Screen>
  }
  if (row.type === 'gym') {
    return (
      <Screen>
        <SubHeader title="Redigera" />
        <EmptyState icon="dumbbell" title="Gympass ändras i Träna" text="Gympass loggas set för set och redigeras inte här." />
      </Screen>
    )
  }
  return <ActivityForm key={row.id} initial={row} initialType={row.type} />
}

function ActivityForm({ initial, initialType }: { initial?: ActivityRow; initialType: FormType }) {
  const toast = useToast()
  const save = useSaveActivity()
  const goBack = useGoBack(initial ? `/aktivitet/${initial.id}` : '/aktivitet')
  const now = useNow(30_000)
  const tz = initial?.timezone ?? deviceTimezone()
  const startParts = initial ? zonedParts(initial.started_at, initial.timezone) : null
  const initialDuration = initial ? initial.duration_s : DEFAULT_DURATION_MIN[initialType] * 60
  const isChip = (s: number | null) => s != null && s % 60 === 0 && (DURATION_CHIPS as readonly number[]).includes(s / 60)

  const [type, setType] = useState<FormType>(initialType)
  const [date, setDate] = useState(startParts?.date ?? todayLocal())
  const [time, setTime] = useState<string | null>(startParts?.time ?? null) // null = "now − duration"
  const [durationS, setDurationS] = useState<number | null>(initialDuration)
  const [durationTouched, setDurationTouched] = useState(Boolean(initial))
  const [customOpen, setCustomOpen] = useState(initialDuration != null && !isChip(initialDuration))
  const [customRaw, setCustomRaw] = useState(initialDuration != null && !isChip(initialDuration) ? durationToInput(initialDuration) : '')
  const [rpe, setRpe] = useState<number | null>(initial?.perceived_exertion ?? null)
  const [km, setKm] = useState(initial?.metrics?.distance_m != null ? String(initial.metrics.distance_m / 1000).replace('.', ',') : '')
  const [steps, setSteps] = useState(initial?.metrics?.steps != null ? String(initial.metrics.steps) : '')
  const [hr, setHr] = useState(initial?.metrics?.avg_heart_rate != null ? String(initial.metrics.avg_heart_rate) : '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [moreOpen, setMoreOpen] = useState(Boolean(initial?.metrics?.steps || initial?.metrics?.avg_heart_rate || (initial?.title && initial.type !== 'other')))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const walkRun = type === 'walk' || type === 'run'
  const autoTime = zonedParts(now - (durationS ?? 0) * 1000, tz).time
  const timeValue = time ?? autoTime
  const kmNum = parseNumberInput(km)
  const distanceM = kmNum != null && kmNum >= 0 ? Math.round(kmNum * 1000) : null
  const pace = walkRun ? paceSecondsPerKm(distanceM, durationS) : null

  function changeType(t: FormType) {
    setType(t)
    if (!durationTouched) {
      setDurationS(DEFAULT_DURATION_MIN[t] * 60)
      setCustomOpen(false)
    }
  }
  function pickChip(min: number) {
    setDurationTouched(true)
    setCustomOpen(false)
    setDurationS(min * 60)
  }
  function changeCustom(raw: string) {
    setDurationTouched(true)
    setCustomRaw(raw)
    setDurationS(parseDurationInput(raw))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.started_at = 'Ange datum'
    if (customOpen && customRaw.trim() !== '' && durationS == null) errs.duration_s = 'Skriv minuter, t.ex. 45 eller 27:30'
    if (km.trim() !== '' && (kmNum == null || kmNum < 0)) errs.distance_m = 'Ogiltig distans'
    const stepsNum = parseNumberInput(steps)
    if (steps.trim() !== '' && stepsNum == null) errs.steps = 'Ogiltigt stegantal'
    const hrNum = parseNumberInput(hr)
    if (hr.trim() !== '' && hrNum == null) errs.avg_heart_rate = 'Ogiltig puls'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const parsed = activityInputSchema.safeParse({
      type,
      started_at: zonedIso(date, timeValue, tz),
      timezone: tz,
      duration_s: durationS,
      perceived_exertion: rpe,
      title: title.trim() || null,
      notes: notes.trim() || null,
      distance_m: distanceM,
      steps: stepsNum,
      avg_heart_rate: hrNum,
      max_heart_rate: initial?.metrics?.max_heart_rate ?? null,
    })
    if (!parsed.success) {
      const fe: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? 'form')
        fe[SHOWN_ERRORS.has(k) && (k !== 'duration_s' || customOpen) ? k : 'form'] ??= issue.message
      }
      setErrors(fe)
      return
    }
    setErrors({})
    save.mutate({ id: initial?.id, input: parsed.data }, {
      onSuccess: () => { toast('Sparat'); goBack() },
      onError: (err) => toast(err.message, { tone: 'error' }),
    })
  }

  const distanceField = (
    <Field label="Distans (km)" error={errors.distance_m}>
      {(fid) => (
        <TextInput id={fid} inputMode="decimal" placeholder="0,0" value={km} invalid={Boolean(errors.distance_m)}
          onChange={(e) => setKm(e.target.value)} />
      )}
    </Field>
  )

  return (
    <Screen>
      <SubHeader title={initial ? 'Redigera aktivitet' : 'Ny aktivitet'} />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <section className="space-y-2.5">
          <ChipGroup label="Typ" value={type} onChange={changeType} options={TYPE_OPTIONS} />
          {!initial && (
            <Link to="/traning" className="inline-flex items-center gap-1 px-0.5 text-[13px] text-faint hover:text-muted">
              Gympass startar du under Träna <Icon name="chevronRight" size={14} />
            </Link>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum" error={errors.started_at}>
            {(fid) => (
              <TextInput id={fid} type="date" value={date} max={todayLocal()} invalid={Boolean(errors.started_at)}
                onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
          <Field label="Starttid" hint={time == null ? 'Nu minus tiden' : undefined}>
            {(fid) => (
              <TextInput id={fid} type="time" value={timeValue}
                onChange={(e) => setTime(e.target.value || null)} />
            )}
          </Field>
        </div>

        <section className="space-y-2">
          <div className="px-0.5 text-[13px] font-medium text-muted" id="dur-label">Tid</div>
          <div role="radiogroup" aria-labelledby="dur-label" className="grid grid-cols-6 gap-1.5">
            {DURATION_CHIPS.map((m) => {
              const on = !customOpen && durationS === m * 60
              return (
                <button key={m} type="button" role="radio" aria-checked={on} onClick={() => pickChip(m)}
                  className={cn('tabular h-11 rounded-xl border text-[14px] font-semibold transition-colors',
                    on ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line bg-sunken text-muted hover:text-fg')}>
                  {m}
                </button>
              )
            })}
            <button type="button" role="radio" aria-checked={customOpen}
              onClick={() => { setDurationTouched(true); setCustomOpen(true); setCustomRaw(durationS != null ? durationToInput(durationS) : '') }}
              className={cn('h-11 rounded-xl border text-[13px] font-semibold transition-colors',
                customOpen ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line bg-sunken text-muted hover:text-fg')}>
              Annan
            </button>
          </div>
          {customOpen ? (
            <Field label="Egen tid" error={errors.duration_s ?? null} hint="Minuter, eller mm:ss / h:mm:ss">
              {(fid) => (
                <TextInput id={fid} autoFocus inputMode="decimal" placeholder="t.ex. 52 eller 27:30" value={customRaw}
                  invalid={Boolean(errors.duration_s)} onChange={(e) => changeCustom(e.target.value)} />
              )}
            </Field>
          ) : (
            <p className="px-0.5 text-[12px] text-faint">minuter</p>
          )}
        </section>

        {walkRun && (
          <div className="grid grid-cols-2 items-start gap-3">
            {distanceField}
            <div className="space-y-1.5">
              <div className="px-0.5 text-[13px] font-medium text-muted">Tempo</div>
              <div className="tabular flex h-12 items-center rounded-[var(--radius-control)] bg-raised/60 px-3.5 text-[16px] font-semibold" aria-live="polite">
                {pace != null ? formatPace(pace) : <span className="text-faint">–</span>}
              </div>
            </div>
          </div>
        )}

        {type === 'other' && (
          <Field label="Vad gjorde du? (valfritt)">
            {(fid) => <TextInput id={fid} placeholder="t.ex. Padel" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
        )}

        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-0.5">
            <span id="rpe-label" className="text-[13px] font-medium text-muted">Ansträngning (valfritt)</span>
            <span className="text-[12px] text-faint">{rpe != null ? RPE_HINT[rpe] : '1 lätt – 10 max'}</span>
          </div>
          <div role="radiogroup" aria-labelledby="rpe-label" className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rpe === n} aria-label={`${n}, ${RPE_HINT[n]}`}
                onClick={() => setRpe((r) => (r === n ? null : n))}
                className={cn('tabular h-10 rounded-lg text-[14px] font-semibold transition-colors',
                  rpe === n ? 'bg-accent text-on-accent' : rpe != null && n < rpe ? 'bg-accent-soft text-accent' : 'bg-sunken text-muted ring-1 ring-line hover:text-fg')}>
                {n}
              </button>
            ))}
          </div>
          {errors.perceived_exertion && <p role="alert" className="px-0.5 text-[13px] text-danger">{errors.perceived_exertion}</p>}
        </section>

        <Field label="Anteckning (valfritt)" error={errors.notes}>
          {(fid) => <TextArea id={fid} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>

        <div>
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}
            className="flex h-11 items-center gap-1.5 px-0.5 text-[14px] font-semibold text-muted hover:text-fg">
            <Icon name={moreOpen ? 'chevronUp' : 'chevronDown'} size={18} />
            Mer
          </button>
          {moreOpen && (
            <Card className="mt-2 space-y-4 animate-fade-in">
              {type !== 'other' && (
                <Field label="Rubrik (valfritt)">
                  {(fid) => <TextInput id={fid} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
                </Field>
              )}
              {!walkRun && distanceField}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Steg" error={errors.steps}>
                  {(fid) => <TextInput id={fid} inputMode="numeric" value={steps} invalid={Boolean(errors.steps)} onChange={(e) => setSteps(e.target.value)} />}
                </Field>
                <Field label="Snittpuls" error={errors.avg_heart_rate}>
                  {(fid) => <TextInput id={fid} inputMode="numeric" placeholder="slag/min" value={hr} invalid={Boolean(errors.avg_heart_rate)} onChange={(e) => setHr(e.target.value)} />}
                </Field>
              </div>
            </Card>
          )}
        </div>

        {errors.form && <p role="alert" className="text-[13px] text-danger">{errors.form}</p>}
        <Button type="submit" variant="primary" size="lg" block loading={save.isPending}>Spara</Button>
      </form>
    </Screen>
  )
}
