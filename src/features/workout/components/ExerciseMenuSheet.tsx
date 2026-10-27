import type { PerformedExercise } from '@/data/workout'
import { cn } from '@/ui/cn'
import { Icon, type IconName } from '@/ui/Icon'
import { Sheet } from '@/ui/Sheet'
import { Spinner } from '@/ui/Spinner'
import { useArmed } from './useArmed'

/** Per-exercise actions: swap (keeps the plan) or remove (second tap confirms). */
export function ExerciseMenuSheet({ exercise, busy, onClose, onSwap, onRemove }: {
  exercise: PerformedExercise | null
  busy: boolean
  onClose: () => void
  onSwap: () => void
  onRemove: () => void
}) {
  return (
    <Sheet open={exercise != null} onClose={onClose} title={exercise?.exercise_name ?? 'Övning'}>
      {exercise && <MenuBody key={exercise.id} exercise={exercise} busy={busy} onSwap={onSwap} onRemove={onRemove} />}
    </Sheet>
  )
}

function MenuBody({ exercise, busy, onSwap, onRemove }: {
  exercise: PerformedExercise; busy: boolean; onSwap: () => void; onRemove: () => void
}) {
  const confirm = useArmed()
  const done = exercise.sets.filter((s) => s.completed_at).length
  return (
    <div className="space-y-2 pb-1">
      <MenuItem icon="swap" title="Byt övning" text="Behåller antal set och repsintervall." disabled={busy} onClick={onSwap} />
      <MenuItem
        icon="trash"
        tone="danger"
        armed={confirm.armed}
        disabled={busy}
        title={confirm.armed ? 'Tryck igen för att ta bort' : 'Ta bort övning'}
        text={done > 0 ? `${done} klarmarkerade set tas också bort.` : 'Övningen och dess set tas bort från passet.'}
        busy={busy && confirm.armed}
        onClick={() => { if (confirm.armed) onRemove(); else confirm.arm() }}
      />
    </div>
  )
}

function MenuItem({ icon, title, text, onClick, disabled, tone = 'neutral', armed, busy }: {
  icon: IconName; title: string; text: string; onClick: () => void
  disabled?: boolean; tone?: 'neutral' | 'danger'; armed?: boolean; busy?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        'flex min-h-16 w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.99] disabled:opacity-50',
        armed ? 'border-danger/50 bg-danger-soft' : 'border-line/70 bg-sunken/50 active:bg-raised',
      )}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl',
        tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-raised text-muted')}>
        {busy ? <Spinner size={18} /> : <Icon name={icon} size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold', tone === 'danger' && 'text-danger')}>{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
    </button>
  )
}
