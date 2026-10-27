import { addDays, addMonths, type DateRange, isoWeek, type Period, startOfMonth } from '@/domain/dates'
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
