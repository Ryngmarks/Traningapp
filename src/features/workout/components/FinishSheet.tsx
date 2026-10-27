import { useState } from 'react'
import { formatDuration, formatNumber } from '@/domain/format'
import { totalVolume } from '@/domain/progression'
import { elapsedSeconds } from '@/domain/workout'
import type { PerformedExercise } from '@/data/workout'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { Stat } from '@/ui/Stat'
import { useNow } from '@/ui/useNow'
import { useArmed } from './useArmed'

type Pending = 'finish' | 'discard' | null

/**
 * Compact summary before finishing. Finishing is allowed with open sets (they
 * are dropped by the server); discarding needs a second tap.
 */
export function FinishSheet({ open, onClose, exercises, startedAt, unsavedCount, onFinish, onDiscard }: {
  open: boolean
  onClose: () => void
  exercises: readonly PerformedExercise[]
  startedAt: string
  unsavedCount: number
  onFinish: () => Promise<void>
  onDiscard: () => Promise<void>
}) {
  const [pending, setPending] = useState<Pending>(null)
  const discard = useArmed()

  const close = () => { if (pending) return; discard.reset(); onClose() }
  const run = async (kind: Exclude<Pending, null>, fn: () => Promise<void>) => {
    setPending(kind)
    try { await fn() } finally { setPending(null) }
  }

  return (
    <Sheet open={open} onClose={close} title="Avsluta pass"
      footer={
        <div className="space-y-2">
          <Button variant="primary" size="lg" block icon="check" loading={pending === 'finish'} disabled={pending != null}
            onClick={() => void run('finish', onFinish)}>
            Avsluta
          </Button>
          <Button variant={discard.armed ? 'danger' : 'ghost'} size="md" block icon="trash"
            loading={pending === 'discard'} disabled={pending != null}
            onClick={() => { if (discard.armed) { discard.reset(); void run('discard', onDiscard) } else discard.arm() }}>
            {discard.armed ? 'Tryck igen för att slänga passet' : 'Släng pass'}
          </Button>
        </div>
      }>
      {open && <Summary exercises={exercises} startedAt={startedAt} unsavedCount={unsavedCount} />}
    </Sheet>
  )
}

function Summary({ exercises, startedAt, unsavedCount }: {
  exercises: readonly PerformedExercise[]; startedAt: string; unsavedCount: number
}) {
  const now = useNow(1000)
  const sets = exercises.flatMap((e) => e.sets)
  const done = sets.filter((s) => s.completed_at)
  const open = sets.length - done.length
  const volume = totalVolume(done)
  const exercisesDone = exercises.filter((e) => e.sets.some((s) => s.completed_at)).length

  return (
    <div className="pb-1">
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-line/70 bg-sunken/50 px-4 py-3.5">
        <Stat label="Set" value={done.length} sub={`${exercisesDone} övn.`} />
        <Stat label="Volym" value={formatNumber(volume)} unit="kg" />
        <Stat label="Tid" value={formatDuration(elapsedSeconds(startedAt, now), 'clock')} />
      </div>
      <ul className="mt-3 space-y-1.5 px-1 text-[13px] leading-snug text-muted">
        {done.length === 0 && <li>Inga set är klarmarkerade. Passet sparas utan övningar.</li>}
        {open > 0 && done.length > 0 && <li>{open} set som inte är klarmarkerade sparas inte.</li>}
        {unsavedCount > 0 && <li className="text-warning">{unsavedCount} ändringar sparas först.</li>}
      </ul>
    </div>
  )
}
