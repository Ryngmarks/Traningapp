import { Link } from 'react-router'
import type { ActivityRow } from '@/data/activities'
import { formatDay, formatDistance, formatDuration, formatPace, paceSecondsPerKm, SOURCE_LABEL } from '@/domain/format'
import type { ActivityType } from '@/domain/types'
import { ActivityIcon, Pill } from '@/ui/Badge'
import { activityTitle, zonedParts } from './helpers'

export const QUICK_TYPES: readonly { type: ActivityType; label: string }[] = [
  { type: 'football_training', label: 'Fotboll' },
  { type: 'football_match', label: 'Match' },
  { type: 'run', label: 'Löpning' },
  { type: 'walk', label: 'Promenad' },
  { type: 'other', label: 'Övrigt' },
]

/** Duration, distance and pace on one quiet line. */
export function activityMeta(a: ActivityRow): string {
  const parts: string[] = []
  if (a.duration_s != null) parts.push(formatDuration(a.duration_s))
  const dist = a.metrics?.distance_m
  if (dist != null && dist > 0) {
    parts.push(formatDistance(dist))
    if (a.type === 'run' || a.type === 'walk') {
      const pace = paceSecondsPerKm(dist, a.duration_s)
      if (pace != null) parts.push(formatPace(pace))
    }
  }
  return parts.join(' · ')
}

export function ActivityListItem({ a }: { a: ActivityRow }) {
  const meta = activityMeta(a)
  const time = zonedParts(a.started_at, a.timezone).time
  return (
    <Link
      to={`/aktivitet/${a.id}`}
      className="flex min-h-[68px] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-raised/60 active:bg-raised"
    >
      <ActivityIcon type={a.type} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{activityTitle(a)}</span>
          <span className="shrink-0 text-[12px] text-faint">{formatDay(a.local_date)} · {time}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="tabular min-w-0 flex-1 truncate text-[13px] text-muted">{meta || '–'}</span>
          {a.perceived_exertion != null && <Pill className="h-5 px-2 text-[11px]">RPE {a.perceived_exertion}</Pill>}
          {a.source !== 'manual' && <Pill className="h-5 px-2 text-[11px]">{SOURCE_LABEL[a.source]}</Pill>}
        </div>
      </div>
    </Link>
  )
}
