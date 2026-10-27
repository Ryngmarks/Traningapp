import { useState } from 'react'
import { formatDuration } from '@/domain/format'
import { type ActivityRow, useUpdateActivityTime } from '@/data/activities'
import { toDataError } from '@/data/errors'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import { zonedIso, zonedParts } from './helpers'

const MAX_MINUTES = 600

/**
 * Correct when a session started and how long it lasted, e.g. a gym workout
 * that was left running after leaving the gym.
 */
export function AdjustTimeSheet({ activity: a, open, onClose }: { activity: ActivityRow; open: boolean; onClose: () => void }) {
  const start = zonedParts(a.started_at, a.timezone)
  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(start.time)
  const [minutes, setMinutes] = useState(a.duration_s != null ? String(Math.round(a.duration_s / 60)) : '60')
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateActivityTime()
  const toast = useToast()

  const mins = Number(minutes.replace(',', '.'))
  const validMinutes = Number.isFinite(mins) && mins >= 1 && mins <= MAX_MINUTES
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
  const endText = validStart && validMinutes
    ? zonedParts(Date.parse(zonedIso(date, time, a.timezone)) + mins * 60_000, a.timezone).time
    : null

  function save() {
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return setError('Ange datum och starttid.')
    if (!validMinutes) return setError(`Längden måste vara 1–${MAX_MINUTES} minuter.`)
    const startedAt = zonedIso(date, time, a.timezone)
    if (Date.parse(startedAt) > Date.now()) return setError('Starttiden kan inte vara i framtiden.')
    update.mutate({ id: a.id, startedAt, durationS: Math.round(mins * 60) }, {
      onSuccess: () => { toast('Tiden är justerad'); onClose() },
      onError: (e) => setError(toDataError(e).message),
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Justera tid"
      footer={<Button variant="primary" size="lg" block loading={update.isPending} onClick={save}>Spara</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            {(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Start">
            {(id) => <TextInput id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        <Field label="Längd (minuter)" hint={validMinutes && endText ? `Slutar kl. ${endText} · ${formatDuration(Math.round(mins * 60))}` : undefined}>
          {(id) => (
            <TextInput id={id} inputMode="numeric" value={minutes} invalid={!validMinutes}
              onFocus={(e) => e.currentTarget.select()} onChange={(e) => setMinutes(e.target.value)} />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          {[45, 60, 75, 90].map((m) => (
            <Button key={m} size="sm" variant={Number(minutes) === m ? 'primary' : 'secondary'} onClick={() => setMinutes(String(m))}>{m} min</Button>
          ))}
        </div>
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">{error}</p>}
      </div>
    </Sheet>
  )
}
