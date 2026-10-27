import { formatDistance, formatDuration } from '@/domain/format'
import type { ExerciseSnapshot } from '@/domain/progression'
import { formatKg } from './workoutText'

function formatValue(v: number, unit: ExerciseSnapshot['unit']): string {
  switch (unit) {
    case 'kg': return formatKg(v)
    case 'reps': return `${v} reps`
    case 'seconds': return formatDuration(v)
    case 'metres': return formatDistance(v)
  }
}

/** Small "PB / Senast / Oftast" box beside an exercise in the active workout. */
export function SnapshotBox({ snapshot: s }: { snapshot: ExerciseSnapshot }) {
  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'PB', value: formatValue(s.best, s.unit) + (s.bestReps ? ` ×${s.bestReps}` : ''), accent: true },
    { label: 'Senast', value: formatValue(s.last, s.unit) },
  ]
  if (s.common != null && s.sessions > 1) rows.push({ label: 'Oftast', value: formatValue(s.common, s.unit) })
  return (
    <dl className="shrink-0 rounded-xl bg-sunken px-2.5 py-1.5 ring-1 ring-line/60" aria-label="Din historik för övningen">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-2.5 leading-tight">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-faint">{r.label}</dt>
          <dd className={`tabular text-[13px] font-semibold ${r.accent ? 'text-accent' : 'text-fg'}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
