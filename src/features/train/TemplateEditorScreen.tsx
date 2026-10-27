import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MEASUREMENT_LABEL } from '@/domain/format'
import type { MeasurementType } from '@/domain/types'
import { parseNumberInput, templateSchema } from '@/domain/validation'
import { toDataError } from '@/data/errors'
import type { Exercise } from '@/data/exercises'
import { useUserId } from '@/data/auth'
import { isOwnTemplate, type Template, useDeleteTemplate, useSaveTemplate, useTemplate } from '@/data/templates'
import { Button, IconButton } from '@/ui/Button'
import { SectionTitle } from '@/ui/Card'
import { Field, TextArea, TextInput } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Screen, SubHeader } from '@/ui/Page'
import { Banner, ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { CountStepper } from './components/CountStepper'
import { ExercisePicker } from './components/ExercisePicker'
import { SharedTemplateView } from './SharedTemplateView'

export function TemplateEditorScreen() {
  const { id } = useParams()
  const tpl = useTemplate(id)
  const userId = useUserId()
  if (!id) return <TemplateForm key="new" />
  if (tpl.isPending) {
    return (
      <Screen>
        <SubHeader title="Mall" back="/traning" />
        <div className="space-y-4" aria-busy="true" aria-label="Laddar">
          <Skeleton className="h-12" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        </div>
      </Screen>
    )
  }
  if (tpl.error) {
    return (
      <Screen>
        <SubHeader title="Mall" back="/traning" />
        <ErrorState error={tpl.error} onRetry={() => void tpl.refetch()} />
      </Screen>
    )
  }
  // Shared and global templates are read-only: start or copy them instead.
  if (!isOwnTemplate(tpl.data, userId)) return <SharedTemplateView template={tpl.data} />
  return <TemplateForm key={tpl.data.id} template={tpl.data} />
}

// ---------------------------------------------------------------------------

interface ItemMeta { name: string; measurement_type: MeasurementType }

interface DraftItem {
  key: string
  id?: string
  exercise_id: string
  meta: ItemMeta
  warmup_sets: number
  planned_sets: number
  // Kept as typed text so "8" → "" → "10" edits feel natural.
  rep_min: string
  rep_max: string
  target_duration_s: string
  target_distance_m: string
  rest_seconds: number | null
  notes: string | null
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const isReps = (m: MeasurementType) => m === 'weight_reps' || m === 'bodyweight_reps'

function fromTemplate(t: Template): DraftItem[] {
  return t.items.map((i) => ({
    key: i.id,
    id: i.id,
    exercise_id: i.exercise_id,
    meta: { name: i.exercise?.name ?? 'Okänd övning', measurement_type: i.exercise?.measurement_type ?? 'weight_reps' },
    warmup_sets: i.warmup_sets,
    planned_sets: i.planned_sets,
    rep_min: str(i.rep_min),
    rep_max: str(i.rep_max),
    target_duration_s: str(i.target_duration_s),
    target_distance_m: str(i.target_distance_m),
    rest_seconds: i.rest_seconds,
    notes: i.notes,
  }))
}

function newItem(e: Exercise): DraftItem {
  const m = e.measurement_type
  return {
    key: crypto.randomUUID(),
    exercise_id: e.id,
    meta: { name: e.name, measurement_type: m },
    warmup_sets: 0,
    planned_sets: 3,
    rep_min: isReps(m) ? '8' : '',
    rep_max: isReps(m) ? '12' : '',
    target_duration_s: m === 'duration' ? '30' : '',
    target_distance_m: m === 'distance' ? '20' : '',
    rest_seconds: null,
    notes: null,
  }
}

/** Empty → null, invalid text → NaN (so validation reports it). */
function num(s: string): number | null {
  if (s.trim() === '') return null
  return parseNumberInput(s) ?? Number.NaN
}

function toPayload(name: string, notes: string, items: DraftItem[]) {
  return {
    name,
    notes: notes.trim() === '' ? null : notes,
    items: items.map((i) => {
      const m = i.meta.measurement_type
      return {
        ...(i.id ? { id: i.id } : {}),
        exercise_id: i.exercise_id,
        warmup_sets: i.warmup_sets,
        planned_sets: i.planned_sets,
        rep_min: isReps(m) ? num(i.rep_min) : null,
        rep_max: isReps(m) ? num(i.rep_max) : null,
        target_duration_s: m === 'duration' ? num(i.target_duration_s) : null,
        target_distance_m: m === 'distance' ? num(i.target_distance_m) : null,
        rest_seconds: i.rest_seconds,
        notes: i.notes,
      }
    }),
  }
}

function TemplateForm({ template }: { template?: Template }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveTemplate()
  const del = useDeleteTemplate()
  const [name, setName] = useState(template?.name ?? '')
  const [notes, setNotes] = useState(template?.notes ?? '')
  const [items, setItems] = useState<DraftItem[]>(() => (template ? fromTemplate(template) : []))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pickedIds = useMemo(() => new Set(items.map((i) => i.exercise_id)), [items])

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  // Item errors are keyed by index, so drop them when the order changes.
  const move = (index: number, dir: -1 | 1) => { setErrors({}); setItems((xs) => {
    const j = index + dir
    if (j < 0 || j >= xs.length) return xs
    const next = [...xs]
    ;[next[index], next[j]] = [next[j]!, next[index]!]
    return next
  }) }
  const remove = (key: string) => { setErrors({}); setItems((xs) => xs.filter((x) => x.key !== key)) }

  const onSave = () => {
    const parsed = templateSchema.safeParse(toPayload(name, notes, items))
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.')
        if (!errs[k]) errs[k] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})
    save.mutate({ id: template?.id, input: parsed.data }, {
      onSuccess: () => { toast('Mallen sparad'); navigate('/traning') },
    })
  }

  const onDelete = () => {
    if (!template) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    del.mutate(template.id, {
      onSuccess: () => { toast('Mallen borttagen', { tone: 'info' }); navigate('/traning') },
      onError: () => setConfirmDelete(false),
    })
  }

  const busy = save.isPending || del.isPending
  const mutationError = save.error ?? del.error

  return (
    <Screen>
      <SubHeader title={template ? 'Redigera mall' : 'Ny mall'} back="/traning"
        action={<Button size="sm" variant="primary" loading={save.isPending} disabled={busy} onClick={onSave} className="mr-1">Spara</Button>} />

      <div className="space-y-4">
        <Field label="Namn" error={errors.name}>
          {(fid) => (
            <TextInput id={fid} value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Styrka A"
              maxLength={80} invalid={Boolean(errors.name)} autoFocus={!template} enterKeyHint="done" />
          )}
        </Field>
        <Field label="Anteckningar (valfritt)" error={errors.notes}>
          {(fid) => (
            <TextArea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000}
              placeholder="Fokus, upplägg …" className="min-h-20" />
          )}
        </Field>
      </div>

      <SectionTitle>{items.length > 0 ? `Övningar · ${items.length}` : 'Övningar'}</SectionTitle>
      {errors.items && <p role="alert" className="mb-2 px-1 text-[13px] text-danger">{errors.items}</p>}

      {items.length === 0 ? (
        <button type="button" onClick={() => setPickerOpen(true)}
          className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-8 text-center text-muted transition-colors hover:text-fg">
          <Icon name="plus" size={24} />
          <span className="text-[15px] font-semibold">Lägg till övningar</span>
        </button>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={item.key}>
              <ItemEditor item={item} index={i} count={items.length} errors={errors}
                onChange={(p) => patchItem(item.key, p)} onMove={(d) => move(i, d)} onRemove={() => remove(item.key)} />
            </li>
          ))}
          <li>
            <Button block icon="plus" onClick={() => setPickerOpen(true)}>Lägg till övning</Button>
          </li>
        </ol>
      )}

      {template && items.length > 0 && (
        <p className="mt-3 px-1 text-[12px] text-faint">Ändringar gäller nya pass. Tidigare pass påverkas inte.</p>
      )}

      {mutationError && (
        <div className="mt-4"><Banner tone="danger">{toDataError(mutationError).message}</Banner></div>
      )}

      <Button block size="lg" variant="primary" className="mt-6" loading={save.isPending} disabled={busy} onClick={onSave}>
        Spara mall
      </Button>

      {template && (
        <Button block variant={confirmDelete ? 'danger' : 'ghost'} icon="trash" className="mt-3"
          loading={del.isPending} disabled={busy} onClick={onDelete}>
          {confirmDelete ? 'Tryck igen för att ta bort' : 'Ta bort mall'}
        </Button>
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} multi pickedIds={pickedIds}
        title="Lägg till övningar"
        onPick={(e) => setItems((xs) => [...xs, newItem(e)])} />
    </Screen>
  )
}

function ItemEditor({ item, index, count, errors, onChange, onMove, onRemove }: {
  item: DraftItem
  index: number
  count: number
  errors: Record<string, string>
  onChange: (p: Partial<DraftItem>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const m = item.meta.measurement_type
  const err = (f: string) => errors[`items.${index}.${f}`]
  const repErr = err('rep_min') ?? err('rep_max')
  return (
    <div className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 pt-3">
      <div className="flex items-center gap-1">
        <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg bg-raised text-[13px] font-semibold text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1 pl-2">
          <div className="truncate text-[16px] font-semibold">{item.meta.name}</div>
          <div className="text-[12px] text-faint">{MEASUREMENT_LABEL[m]}</div>
        </div>
        <IconButton icon="chevronUp" label={`Flytta upp ${item.meta.name}`} disabled={index === 0} onClick={() => onMove(-1)} />
        <IconButton icon="chevronDown" label={`Flytta ned ${item.meta.name}`} disabled={index === count - 1} onClick={() => onMove(1)} />
        <IconButton icon="trash" label={`Ta bort ${item.meta.name}`} onClick={onRemove} className="hover:text-danger" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <CountStepper label="Uppvärmning" value={item.warmup_sets} min={0} max={10} onChange={(v) => onChange({ warmup_sets: v })} />
        <CountStepper label="Arbetsset" value={item.planned_sets} min={1} max={20} onChange={(v) => onChange({ planned_sets: v })} />
      </div>

      <div className="mt-3">
        {isReps(m) ? (
          <>
            <div className="mb-1.5 px-0.5 text-[13px] font-medium text-muted">Reps (min–max)</div>
            <div className="flex items-center gap-2">
              <TextInput inputMode="numeric" aria-label="Minsta antal reps" value={item.rep_min} placeholder="8"
                invalid={Boolean(err('rep_min'))} className="tabular text-center"
                onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange({ rep_min: e.target.value })} />
              <span className="text-faint" aria-hidden="true">–</span>
              <TextInput inputMode="numeric" aria-label="Högsta antal reps" value={item.rep_max} placeholder="12"
                invalid={Boolean(err('rep_max'))} className="tabular text-center"
                onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange({ rep_max: e.target.value })} />
            </div>
            {repErr && <p role="alert" className="mt-1.5 px-0.5 text-[13px] text-danger">{repErr}</p>}
          </>
        ) : m === 'duration' ? (
          <Field label="Mål (sekunder)" error={err('target_duration_s')}>
            {(fid) => (
              <TextInput id={fid} inputMode="numeric" value={item.target_duration_s} placeholder="30"
                invalid={Boolean(err('target_duration_s'))} className="tabular"
                onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange({ target_duration_s: e.target.value })} />
            )}
          </Field>
        ) : (
          <Field label="Mål (meter)" error={err('target_distance_m')}>
            {(fid) => (
              <TextInput id={fid} inputMode="numeric" value={item.target_distance_m} placeholder="20"
                invalid={Boolean(err('target_distance_m'))} className="tabular"
                onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange({ target_distance_m: e.target.value })} />
            )}
          </Field>
        )}
      </div>
    </div>
  )
}
