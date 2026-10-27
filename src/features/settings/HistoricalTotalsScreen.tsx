import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { toFact, useActivities } from '@/data/activities'
import { type HistoricalTotalRow, useDeleteHistoricalTotal, useHistoricalTotals, useSaveHistoricalTotal } from '@/data/totals'
import { ACTIVITY_LABEL, formatDistance, formatDuration, formatLongDate, formatNumber } from '@/domain/format'
import { activitiesCoveredBy } from '@/domain/stats'
import { ACTIVITY_TYPES } from '@/domain/types'
import { ActivityIcon, Pill } from '@/ui/Badge'
import { Button, IconButton } from '@/ui/Button'
import { ChipGroup, Field, TextArea, TextInput } from '@/ui/Field'
import { Screen, SubHeader } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { todayLocal } from '@/ui/useNow'
import { historicalSummary } from '../stats/helpers'
import { emptyTotalForm, parseTotalForm, type TotalForm, totalToForm } from './helpers'

const TYPE_OPTIONS = ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABEL[t] }))

/** null = closed, 'new' = add, row = edit. */
type Editing = null | 'new' | HistoricalTotalRow

export function HistoricalTotalsScreen() {
  const totals = useHistoricalTotals()
  const activities = useActivities()
  const [editing, setEditing] = useState<Editing>(null)

  const facts = useMemo(() => (activities.data ?? []).map(toFact), [activities.data])

  return (
    <Screen>
      <SubHeader title="Historiska totaler" back="/installningar"
        action={<IconButton icon="plus" label="Lägg till total" onClick={() => setEditing('new')} />} />

      <p className="mb-5 px-1 text-[14px] leading-relaxed text-muted">
        Pass från före appen, utan datum. De räknas bara i <span className="text-fg">Totalt</span>.
        Daterade pass av samma typ till och med <span className="text-fg">Gäller till och med</span> antas redan ingå och räknas inte två gånger.
      </p>

      {totals.isPending ? (
        <ListSkeleton rows={3} />
      ) : totals.error ? (
        <ErrorState error={totals.error} onRetry={() => totals.refetch()} />
      ) : totals.data.length === 0 ? (
        <EmptyState
          icon="history"
          title="Inga historiska totaler"
          text="Har du t.ex. 110 gympass innan appen? Lägg in dem som en total."
          action={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Lägg till</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {totals.data.map((t) => (
            <TotalCard key={t.id} t={t} covered={activities.data ? activitiesCoveredBy(t, facts) : null} onEdit={() => setEditing(t)} />
          ))}
        </div>
      )}

      <TotalSheet editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  )
}

function TotalCard({ t, covered, onEdit }: { t: HistoricalTotalRow; covered: number | null; onEdit: () => void }) {
  const extras: string[] = []
  if (t.total_distance_m != null) extras.push(formatDistance(t.total_distance_m))
  if (t.total_duration_s != null) extras.push(formatDuration(t.total_duration_s))
  return (
    <button type="button" onClick={onEdit}
      className="flex w-full items-start gap-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 text-left transition-[transform,border-color] active:scale-[0.99] hover:border-line-strong">
      <ActivityIcon type={t.activity_type} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[16px] font-semibold">{historicalSummary([t]) || `0 ${ACTIVITY_LABEL[t.activity_type].toLowerCase()}`}</span>
          {extras.length > 0 && <span className="tabular shrink-0 text-[13px] text-muted">{extras.join(' · ')}</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-muted">
          {t.period_start ? `${formatLongDate(t.period_start)} – ` : 't.o.m. '}{formatLongDate(t.covers_until)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {covered != null && (
            <Pill tone={covered > 0 ? 'warning' : 'neutral'}>
              {covered === 0 ? 'Täcker inga daterade pass' : `Täcker ${formatNumber(covered)} daterade pass`}
            </Pill>
          )}
          {t.source_label && <Pill>{t.source_label}</Pill>}
        </div>
      </div>
    </button>
  )
}

function TotalSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const open = editing !== null
  const row = editing !== null && editing !== 'new' ? editing : null
  return (
    <Sheet open={open} onClose={onClose} title={row ? 'Redigera total' : 'Ny historisk total'}>
      {open && <TotalFormView key={row?.id ?? 'new'} row={row} onDone={onClose} />}
    </Sheet>
  )
}

function TotalFormView({ row, onDone }: { row: HistoricalTotalRow | null; onDone: () => void }) {
  const toast = useToast()
  const save = useSaveHistoricalTotal()
  const del = useDeleteHistoricalTotal()
  const today = todayLocal()
  const [form, setForm] = useState<TotalForm>(() => (row ? totalToForm(row) : emptyTotalForm(today)))
  const [errors, setErrors] = useState<Partial<Record<keyof TotalForm | 'form', string>>>({})
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const set = <K extends keyof TotalForm>(k: K, v: TotalForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const r = parseTotalForm(form)
    if (!r.ok) { setErrors(r.errors); return }
    setErrors({})
    save.mutate({ id: row?.id, input: r.input }, {
      onSuccess: () => { toast('Sparat'); onDone() },
      onError: (err) => toast(err.message, { tone: 'error' }),
    })
  }

  function onDelete() {
    if (!row) return
    if (!armed) { setArmed(true); return }
    del.mutate(row.id, {
      onSuccess: () => { toast('Borttaget'); onDone() },
      onError: (err) => { setArmed(false); toast(err.message, { tone: 'error' }) },
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pt-2">
      <ChipGroup label="Typ" value={form.activity_type} onChange={(v) => set('activity_type', v)} options={TYPE_OPTIONS} />

      <Field label="Antal pass" error={errors.count}>
        {(fid) => (
          <TextInput id={fid} inputMode="numeric" placeholder="t.ex. 110" value={form.count} invalid={Boolean(errors.count)}
            onChange={(e) => set('count', e.target.value)} />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Distans (km)" error={errors.km} hint="Valfritt">
          {(fid) => (
            <TextInput id={fid} inputMode="decimal" placeholder="0" value={form.km} invalid={Boolean(errors.km)}
              onChange={(e) => set('km', e.target.value)} />
          )}
        </Field>
        <Field label="Tid (timmar)" error={errors.hours} hint="Valfritt">
          {(fid) => (
            <TextInput id={fid} inputMode="decimal" placeholder="0" value={form.hours} invalid={Boolean(errors.hours)}
              onChange={(e) => set('hours', e.target.value)} />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Från (valfritt)" error={errors.period_start}>
          {(fid) => (
            <TextInput id={fid} type="date" value={form.period_start} max={form.covers_until || undefined}
              invalid={Boolean(errors.period_start)} onChange={(e) => set('period_start', e.target.value)} />
          )}
        </Field>
        <Field label="Gäller till och med" error={errors.covers_until}>
          {(fid) => (
            <TextInput id={fid} type="date" value={form.covers_until} required
              invalid={Boolean(errors.covers_until)} onChange={(e) => set('covers_until', e.target.value)} />
          )}
        </Field>
      </div>

      <Field label="Källa" error={errors.source_label} hint="Valfritt, t.ex. Strava eller träningsdagbok">
        {(fid) => (
          <TextInput id={fid} value={form.source_label} maxLength={120} onChange={(e) => set('source_label', e.target.value)} />
        )}
      </Field>

      <Field label="Anteckning" error={errors.notes}>
        {(fid) => <TextArea id={fid} value={form.notes} maxLength={1000} onChange={(e) => set('notes', e.target.value)} />}
      </Field>

      {errors.form && <p role="alert" className="text-[13px] text-danger">{errors.form}</p>}

      <div className="space-y-2 pb-safe">
        <Button type="submit" variant="primary" size="lg" block loading={save.isPending}>Spara</Button>
        {row && (
          <Button block variant={armed ? 'danger' : 'ghost'} icon="trash" loading={del.isPending} onClick={onDelete}>
            {armed ? 'Tryck igen för att ta bort' : 'Ta bort total'}
          </Button>
        )}
      </div>
    </form>
  )
}
