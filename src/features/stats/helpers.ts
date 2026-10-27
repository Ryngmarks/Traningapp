import { addDays, addMonths, type DateRange, isoWeek, type Period, periodRange, startOfMonth } from '@/domain/dates'
import { formatDay, formatMonth, formatShortDate } from '@/domain/format'
import type { Granularity } from '@/domain/stats'
import type { ActivityType, LocalDate } from '@/domain/types'

// Pure presentation helpers for the statistics screens.

/** Move the anchor date one period back (-1) or forward (+1). */
export function shiftAnchor(period: Exclude<Period, 'all'>, anchor: LocalDate, dir: -1 | 1): LocalDate {
  if (period === 'week') return addDays(anchor, 7 * dir)
  if (period === 'month') return addMonths(startOfMonth(anchor), dir)
  return `${Number(anchor.slice(0, 4)) + dir}-01-01`
}

const monthYear = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Heading and sub-line for the selected period. */
export function periodTitle(period: Period, range: DateRange): { title: string; sub: string | null } {
  switch (period) {
    case 'week':
      return { title: `Vecka ${isoWeek(range.to)}`, sub: `${formatShortDate(range.from!)} – ${formatShortDate(range.to)} ${range.to.slice(0, 4)}` }
    case 'month': {
      const t = monthYear.format(new Date(`${range.from}T00:00:00Z`))
      return { title: t.charAt(0).toUpperCase() + t.slice(1), sub: null }
    }
    case 'year':
      return { title: range.from!.slice(0, 4), sub: null }
    case 'all':
      return { title: 'Hela tiden', sub: null }
  }
}

const WEEKDAY = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'] as const

/** Axis label and tooltip title for a chart bucket. */
export function bucketLabels(start: LocalDate, g: Granularity, multiYear: boolean): { label: string; title: string } {
  if (g === 'day') {
    const dow = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7
    return { label: WEEKDAY[dow]!, title: formatDay(start) }
  }
  if (g === 'week') {
    return { label: `v${isoWeek(start)}`, title: `Vecka ${isoWeek(start)} · ${formatShortDate(start)} – ${formatShortDate(addDays(start, 6))}` }
  }
  const m = formatMonth(start)
  const label = multiYear && start.slice(5, 7) === '01' ? `${m} ${start.slice(2, 4)}` : m
  const t = monthYear.format(new Date(`${start}T00:00:00Z`))
  return { label, title: t.charAt(0).toUpperCase() + t.slice(1) }
}

const NOUN: Record<ActivityType, [string, string]> = {
  gym: ['gympass', 'gympass'],
  football_training: ['fotbollsträning', 'fotbollsträningar'],
  football_match: ['match', 'matcher'],
  walk: ['promenad', 'promenader'],
  run: ['löprunda', 'löprundor'],
  other: ['övrigt pass', 'övriga pass'],
}

/** "110 gympass och 12 matcher" from historical totals (summed per type). */
export function historicalSummary(totals: readonly { activity_type: ActivityType; session_count: number }[]): string {
  const byType = new Map<ActivityType, number>()
  for (const t of totals) byType.set(t.activity_type, (byType.get(t.activity_type) ?? 0) + t.session_count)
  const parts = [...byType].filter(([, n]) => n > 0).map(([type, n]) => `${new Intl.NumberFormat('sv-SE').format(n)} ${NOUN[type][n === 1 ? 0 : 1]}`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} och ${parts[parts.length - 1]}`
}

// ---------------------------------------------------------------------------
// Period navigation
// ---------------------------------------------------------------------------

export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'week', label: 'Vecka' },
  { value: 'month', label: 'Månad' },
  { value: 'year', label: 'År' },
  { value: 'all', label: 'Totalt' },
]

export function isPeriod(v: string | null): v is Period {
  return v === 'week' || v === 'month' || v === 'year' || v === 'all'
}

/** A valid anchor from the URL, or today. Future anchors fall back to today. */
export function parseAnchor(raw: string | null, today: LocalDate): LocalDate {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw)) || raw > today) return today
  return raw
}

/** True when the period after the one containing `anchor` starts after today. */
export function isLatestPeriod(period: Exclude<Period, 'all'>, anchor: LocalDate, today: LocalDate): boolean {
  return periodRange(period, shiftAnchor(period, anchor, 1)).from! > today
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/** Earliest local_date among dated activities, or null. */
export function firstActivityDate(facts: readonly { local_date: LocalDate }[]): LocalDate | null {
  let min: LocalDate | null = null
  for (const f of facts) if (min === null || f.local_date < min) min = f.local_date
  return min
}

/** Non-zero session counts, largest first (stable by type order on ties). */
export function typeRows(sessions: Readonly<Record<ActivityType, number>>): { type: ActivityType; count: number }[] {
  return (Object.entries(sessions) as [ActivityType, number][])
    .filter(([, n]) => n > 0)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

/** Exercises the user has trained, resolved to library rows and sorted by name. */
/** Trained exercises, preferring the current library row (renamed) over the history snapshot (archived). */
export function trainedExercises<E extends { id: string; name: string }>(trained: readonly E[], library: readonly E[]): E[] {
  const byId = new Map(library.map((e) => [e.id, e]))
  return trained.map((t) => byId.get(t.id) ?? t).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}
