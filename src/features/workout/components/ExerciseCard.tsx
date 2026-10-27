import { useMemo, useState } from 'react'
import { suggestProgression } from '@/domain/progression'
import type { SetKind } from '@/domain/types'
import type { LastPerformanceRow, PerformedExercise, PerformedSet } from '@/data/workout'
import { IconButton } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import type { SyncStatus } from '../syncQueue'
import type { SetPatch } from '../useWorkoutSession'
import { setFields } from './setFields'
import { SetRow, setGridClass } from './SetRow'
import { lastText, planText, suggestionText } from './workoutText'

export interface ExerciseCardProps {
  exercise: PerformedExercise
  statuses: Record<string, SyncStatus>
  last: LastPerformanceRow | undefined
  weightStep: number
  today: string
  isCurrent: boolean
  onUpdateSet: (setId: string, patch: SetPatch) => void
  onToggleSet: (setId: string) => boolean
  onAddSet: (kind: SetKind) => void
  onRemoveSet: (set: PerformedSet) => void
  onMore: () => void
}

export function ExerciseCard({
  exercise: ex, statuses, last, weightStep, today, isCurrent,
  onUpdateSet, onToggleSet, onAddSet, onRemoveSet, onMore,
}: ExerciseCardProps) {
  const m = ex.measurement_type
  const fields = useMemo(() => setFields(m, weightStep), [m, weightStep])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const firstOpen = ex.sets.find((s) => !s.completed_at)
  const selected = selectedId && ex.sets.some((s) => s.id === selectedId) ? selectedId : null
  const expandedId = selected ?? (isCurrent ? firstOpen?.id ?? null : null)
  const doneCount = ex.sets.filter((s) => s.completed_at).length
  const allDone = ex.sets.length > 0 && doneCount === ex.sets.length

  // Progression hint: offered, never applied automatically.
  const suggestion = useMemo(() => (last ? suggestProgression(last, m, weightStep) : null), [last, m, weightStep])
  const hint = suggestion ? suggestionText(suggestion) : null
  const openWorking = ex.sets.filter((s) => s.kind === 'working' && !s.completed_at)
  const hintPatch: SetPatch | null = !suggestion ? null
    : suggestion.kind === 'increase_weight' ? { weight_kg: suggestion.toKg, reps: suggestion.reps }
    : suggestion.kind === 'add_reps' ? { reps: suggestion.targetReps }
    : null
  const hintApplied = hintPatch != null && openWorking.every((s) =>
    (hintPatch.weight_kg === undefined || s.weight_kg === hintPatch.weight_kg) &&
    (hintPatch.reps === undefined || s.reps === hintPatch.reps))
  const showHint = hint != null && hintPatch != null && openWorking.length > 0 && !hintApplied

  let working = 0
  let warm = 0
  const rows = ex.sets.map((s) => {
    const isWarm = s.kind === 'warmup'
    const n = isWarm ? ++warm : ++working
    return { set: s, marker: isWarm ? 'U' : String(n), name: isWarm ? `uppvärmningsset ${n}` : `set ${n}` }
  })

  return (
    <section
      id={`ex-${ex.id}`}
      aria-label={ex.exercise_name}
      className={cn(
        'scroll-mt-[calc(84px+env(safe-area-inset-top))] rounded-[var(--radius-card)] border bg-surface px-2.5 pb-2.5 pt-3 transition-colors duration-300',
        isCurrent ? 'border-line-strong' : 'border-line/70',
      )}
    >
      <header className="flex items-start gap-2 pl-1.5">
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold leading-snug">
            <span className="min-w-0 truncate">{ex.exercise_name}</span>
            {allDone && <Icon name="check" size={18} className="shrink-0 text-accent" aria-label="Klar" />}
          </h2>
          <p className="tabular mt-0.5 text-[13px] text-muted">{planText(ex)}</p>
        </div>
        <IconButton icon="more" label={`Fler val för ${ex.exercise_name}`} onClick={onMore} className="-mr-1 -mt-1" />
      </header>

      {(last || showHint) && (
        <div className="mt-1.5 space-y-2 pl-1.5">
          {last && last.sets.length > 0 && (
            <p className="tabular flex items-start gap-1.5 text-[13px] leading-snug text-faint">
              <Icon name="history" size={14} className="mt-[2px] shrink-0" />
              <span><span className="text-muted">Senast</span> {lastText(last, m, today)}</span>
            </p>
          )}
          {showHint && (
            <button type="button"
              onClick={() => { for (const s of openWorking) onUpdateSet(s.id, hintPatch) }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent transition-transform active:scale-95"
              aria-label={`Använd förslaget ${hint} för återstående set`}>
              <Icon name="sparkle" size={14} />
              <span className="tabular">Förslag: {hint}</span>
            </button>
          )}
        </div>
      )}

      {ex.sets.length > 0 && (
        <div className={cn(setGridClass(fields.filter((f) => !f.secondary).length), 'mt-3 px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint')} aria-hidden="true">
          <span className="text-center">Set</span>
          {fields.filter((f) => !f.secondary).map((f) => <span key={f.key} className="text-center">{f.label}</span>)}
          <span />
        </div>
      )}

      <div className="mt-1 space-y-1">
        {rows.map(({ set, marker, name }) => (
          <SetRow
            key={set.id}
            set={set}
            marker={marker}
            name={name}
            fields={fields}
            status={statuses[set.id]}
            expanded={expandedId === set.id}
            isNext={isCurrent && firstOpen?.id === set.id}
            onSelect={() => setSelectedId(set.id)}
            onChange={(patch) => onUpdateSet(set.id, patch)}
            onToggle={() => {
              const wasDone = Boolean(set.completed_at)
              const ok = onToggleSet(set.id)
              // Completing moves the steppers on to the next open set.
              if (ok && !wasDone) setSelectedId(null)
              return ok
            }}
            onRemove={() => { setSelectedId(null); onRemoveSet(set) }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        <AddButton icon="plus" label="Set" aria="Lägg till set" onClick={() => onAddSet('working')} className="flex-1" />
        <AddButton icon="flame" label="Uppvärmning" aria="Lägg till uppvärmningsset" onClick={() => onAddSet('warmup')} />
      </div>
    </section>
  )
}

function AddButton({ icon, label, aria, onClick, className }: {
  icon: 'plus' | 'flame'; label: string; aria: string; onClick: () => void; className?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-label={aria}
      className={cn(
        'flex h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[14px] font-semibold text-muted transition-[transform,background-color,color] duration-150 hover:bg-raised hover:text-fg active:scale-[0.98] active:bg-raised',
        className,
      )}>
      <Icon name={icon} size={17} />
      {label}
    </button>
  )
}
