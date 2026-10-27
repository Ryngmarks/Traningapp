import { useEffect, useRef, useState } from 'react'
import type { PerformedSet } from '@/data/workout'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import type { SyncStatus } from '../syncQueue'
import type { SetPatch } from '../useWorkoutSession'
import { NumberField } from './NumberField'
import { missingFields, type SetField, stepValue, type ValueKey } from './setFields'
import { formatInputNumber } from './workoutText'

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
  { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' },
]

/** Shared column layout for the header row and set rows of one exercise. */
export function setGridClass(fieldCount: number): string {
  return fieldCount === 1
    ? 'grid grid-cols-[40px_minmax(0,1fr)_52px] items-center gap-2'
    : 'grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_52px] items-center gap-2'
}

export interface SetRowProps {
  set: PerformedSet
  /** "1", "2" … for working sets, "U" for warm-ups. */
  marker: string
  /** Accessible name, e.g. "set 2" or "uppvärmningsset 1". */
  name: string
  fields: SetField[]
  status: SyncStatus | undefined
  /** Shows −/+ steppers and the remove button. */
  expanded: boolean
  /** Visually guides the thumb to the next set to complete. */
  isNext: boolean
  onSelect: () => void
  onChange: (patch: SetPatch) => void
  /** Returns false when values are missing. */
  onToggle: () => boolean
  onRemove: () => void
}

export function SetRow({ set, marker, name, fields, status, expanded, isNext, onSelect, onChange, onToggle, onRemove }: SetRowProps) {
  const done = Boolean(set.completed_at)
  const inputs = useRef<Partial<Record<ValueKey, HTMLInputElement | null>>>({})
  const [flash, setFlash] = useState<ValueKey[]>([])
  const grid = setGridClass(fields.length)

  useEffect(() => {
    if (flash.length === 0) return
    const t = setTimeout(() => setFlash([]), 1800)
    return () => clearTimeout(t)
  }, [flash])

  const onCheck = () => {
    if (onToggle()) {
      if (!done) navigator.vibrate?.(10)
      return
    }
    const missing = missingFields(set, fields)
    setFlash(missing)
    for (const k of missing) inputs.current[k]?.animate(SHAKE, { duration: 360, easing: 'ease-out' })
    const first = missing[0]
    if (first) inputs.current[first]?.focus()
  }

  return (
    <div
      onFocusCapture={onSelect}
      className={cn('rounded-2xl px-1.5 py-1.5 transition-colors duration-200', done ? 'bg-accent-soft' : expanded && 'bg-raised/50')}
    >
      <div className={grid}>
        <button type="button" onClick={onSelect} aria-label={`Justera ${name}`}
          className={cn(
            'tabular grid h-12 place-items-center rounded-xl text-[15px] font-semibold transition-colors',
            done ? 'text-accent' : marker === 'U' ? 'text-warning/80' : 'text-muted',
          )}>
          {marker}
        </button>

        {fields.map((f) => (
          <NumberField
            key={f.key}
            ref={(el) => { inputs.current[f.key] = el }}
            value={set[f.key]}
            onChange={(v) => onChange({ [f.key]: v })}
            integer={f.integer}
            max={f.max}
            label={`${f.name}, ${name}`}
            placeholder={f.placeholder}
            invalid={flash.includes(f.key)}
            done={done}
          />
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={onCheck}
            aria-pressed={done}
            aria-label={done ? `Ångra ${name}` : `Klarmarkera ${name}`}
            className={cn(
              'grid size-[52px] place-items-center rounded-2xl transition-[transform,background-color,color,box-shadow] duration-150 active:scale-90',
              done
                ? 'bg-accent text-on-accent animate-pop shadow-[0_6px_18px_-10px_rgb(200_241_105/0.8)]'
                : isNext
                  ? 'bg-raised text-accent ring-1 ring-accent/45'
                  : 'bg-raised text-faint ring-1 ring-line',
            )}
          >
            <Icon name="check" size={26} strokeWidth={done ? 2.5 : 2} />
          </button>
          <SyncDot status={status} />
        </div>
      </div>

      {expanded && (
        <div className={cn(grid, 'mt-1.5 animate-fade-in')}>
          <button type="button" onClick={onRemove} aria-label={`Ta bort ${name}`}
            className="grid h-11 place-items-center rounded-xl text-faint transition-colors hover:text-danger active:text-danger">
            <Icon name="trash" size={18} />
          </button>
          {fields.map((f) => (
            <div key={f.key} className="flex gap-1">
              <StepButton label={`−${formatInputNumber(f.step)}`} aria={`Minska ${f.name.toLowerCase()} med ${formatInputNumber(f.step)}`}
                onClick={() => onChange({ [f.key]: stepValue(set[f.key], f, -1) })} />
              <StepButton label={`+${formatInputNumber(f.step)}`} aria={`Öka ${f.name.toLowerCase()} med ${formatInputNumber(f.step)}`}
                onClick={() => onChange({ [f.key]: stepValue(set[f.key], f, 1) })} />
            </div>
          ))}
          <span />
        </div>
      )}
    </div>
  )
}

function StepButton({ label, aria, onClick }: { label: string; aria: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria}
      className="tabular h-11 min-w-0 flex-1 rounded-xl bg-sunken text-[14px] font-semibold text-muted ring-1 ring-line/70 transition-[transform,color] duration-100 hover:text-fg active:scale-95 active:text-fg">
      {label}
    </button>
  )
}

function SyncDot({ status }: { status: SyncStatus | undefined }) {
  if (!status || status === 'saved') return null
  if (status === 'error') {
    return (
      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-danger ring-2 ring-surface" role="img" aria-label="Inte sparat" />
    )
  }
  return (
    <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-muted ring-2 ring-surface" role="img" aria-label="Sparar" />
  )
}
