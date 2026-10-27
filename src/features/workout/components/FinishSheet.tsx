import { useState } from 'react'
import { formatDuration, formatNumber } from '@/domain/format'
import { totalVolume } from '@/domain/progression'
import { suggestedEndTime } from '@/domain/workout'
import type { PerformedExercise } from '@/data/workout'
import { zonedIso, zonedParts } from '@/features/activity/helpers'
import { Button } from '@/ui/Button'
import { ChipGroup, TextInput } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { Stat } from '@/ui/Stat'
import { useNow } from '@/ui/useNow'
import { useArmed } from './useArmed'

type Pending = 'finish' | 'discard' | null
type EndChoice = 'now' | 'suggested' | 'custom'

/** End time for the chosen option, or null when the custom time is invalid. */
function resolveEnd(choice: EndChoice, nowMs: number, suggested: string | null, custom: string, startedAt: string, timeZone: string): number | null {
  if (choice === 'now') return nowMs
  if (choice === 'suggested' && suggested) return Date.parse(suggested)
  if (!/^\d{2}:\d{2}$/.test(custom)) return null
  const start = Date.parse(startedAt)
  let end = Date.parse(zonedIso(zonedParts(startedAt, timeZone).date, custom, timeZone))
  if (end < start) end += 86_400_000 // past midnight
  return end >= start && end <= nowMs ? end : null
}

/**
 * Compact summary before finishing. Finishing is allowed with open sets (they
 * are dropped by the server); discarding needs a second tap.
 */
export function FinishSheet({ open, onClose, exercises, startedAt, timeZone, unsavedCount, onFinish, onDiscard }: {
  open: boolean
  onClose: () => void
  exercises: readonly PerformedExercise[]
  startedAt: string
  timeZone: string
  unsavedCount: number
  /** endedAt is set when the user corrected the end time. */
  onFinish: (endedAt?: string) => Promise<void>
  onDiscard: () => Promise<void>
}) {
  const [pending, setPending] = useState<Pending>(null)
  const discard = useArmed()
  const now = useNow(1000)
  const suggested = open ? suggestedEndTime(exercises.flatMap((e) => e.sets), now) : null
  // Left running? Default to ending after the last set.
  const [choice, setChoice] = useState<EndChoice | null>(null)
  const effective: EndChoice = choice ?? (suggested ? 'suggested' : 'now')
  const [custom, setCustom] = useState('')
  const endMs = resolveEnd(effective, now, suggested, custom, startedAt, timeZone)
  const hhmm = (ms: number) => zonedParts(ms, timeZone).time

  const close = () => { if (pending) return; discard.reset(); setChoice(null); setCustom(''); onClose() }
  const run = async (kind: Exclude<Pending, null>, fn: () => Promise<void>) => {
    setPending(kind)
    try { await fn() } finally { setPending(null) }
  }

  return (
    <Sheet open={open} onClose={close} title="Avsluta pass"
      footer={
        <div className="space-y-2">
          <Button variant="primary" size="lg" block icon="check" loading={pending === 'finish'} disabled={pending != null || endMs == null}
            onClick={() => void run('finish', () => onFinish(effective === 'now' || endMs == null ? undefined : new Date(endMs).toISOString()))}>
            Avsluta
          </Button>
          <Button variant={discard.armed ? 'danger' : 'ghost'} size="md" block icon="trash"
            loading={pending === 'discard'} disabled={pending != null}
            onClick={() => { if (discard.armed) { discard.reset(); void run('discard', onDiscard) } else discard.arm() }}>
            {discard.armed ? 'Tryck igen för att slänga passet' : 'Släng pass'}
          </Button>
        </div>
      }>
      {open && (
        <>
          <Summary exercises={exercises} durationS={endMs == null ? null : Math.max(0, Math.round((endMs - Date.parse(startedAt)) / 1000))} unsavedCount={unsavedCount} />
          <div className="mt-4 px-1">
            <div className="mb-2 text-[13px] font-medium text-muted">Sluttid</div>
            {suggested && (
              <p className="mb-2 text-[13px] text-warning">Sista setet klarmarkerades kl. {hhmm(Date.parse(suggested) - 5 * 60_000)}. Glömde du avsluta?</p>
            )}
            <ChipGroup<EndChoice> label="Sluttid" value={effective} onChange={setChoice}
              options={[
                ...(suggested ? [{ value: 'suggested' as const, label: `Efter sista setet ${hhmm(Date.parse(suggested))}` }] : []),
                { value: 'now', label: `Nu ${hhmm(now)}` },
                { value: 'custom', label: 'Annan tid' },
              ]} />
            {effective === 'custom' && (
              <div className="mt-3">
                <TextInput type="time" aria-label="Sluttid" value={custom} onChange={(e) => setCustom(e.target.value)}
                  invalid={custom !== '' && endMs == null} />
                {custom !== '' && endMs == null && (
                  <p role="alert" className="mt-1.5 text-[13px] text-danger">Sluttiden måste vara efter start och inte senare än nu.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}

function Summary({ exercises, durationS, unsavedCount }: {
  exercises: readonly PerformedExercise[]; durationS: number | null; unsavedCount: number
}) {
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
        <Stat label="Tid" value={durationS == null ? '–' : formatDuration(durationS, 'clock')} />
      </div>
      <ul className="mt-3 space-y-1.5 px-1 text-[13px] leading-snug text-muted">
        {done.length === 0 && <li>Inga set är klarmarkerade. Passet sparas utan övningar.</li>}
        {open > 0 && done.length > 0 && <li>{open} set som inte är klarmarkerade sparas inte.</li>}
        {unsavedCount > 0 && <li className="text-warning">{unsavedCount} ändringar sparas först.</li>}
      </ul>
    </div>
  )
}
