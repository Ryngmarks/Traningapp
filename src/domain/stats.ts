import { addDays, addMonths, type DateRange, inRange, startOfMonth, startOfWeek } from './dates'
import type { ActivityFact, ActivityType, DailySteps, HistoricalTotal, LocalDate } from './types'
import { ACTIVITY_TYPES } from './types'

/**
 * The single source of truth for activity statistics. The dashboard and the
 * statistics screen both call these functions; never re-implement counting
 * in UI code.
 *
 * Rules (docs/TRAINING_MODEL.md → "Historiska totaler"):
 *  1. Dated activities are counted in the period their local_date falls in.
 *  2. Historical totals have no dates. They only count in the all-time view.
 *  3. A total covers its activity type from period_start (or the beginning
 *     of time) through covers_until. A dated activity of that type inside
 *     the covered interval is assumed to already be part of the total, so in
 *     the all-time view it is not added again. It still shows up in its own
 *     week/month.
 *  4. Steps: a day with an imported daily step total uses that total only;
 *     activity steps are summed only for days without a daily total.
 */

export type CountByType = Record<ActivityType, number>

export function emptyCounts(): CountByType {
  return Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) as CountByType
}

export const isFootball = (t: ActivityType) => t === 'football_training' || t === 'football_match'
export const isWalkOrRun = (t: ActivityType) => t === 'walk' || t === 'run'

export function isCoveredByTotal(a: Pick<ActivityFact, 'type' | 'local_date'>, totals: readonly HistoricalTotal[]): boolean {
  return totals.some((t) =>
    t.activity_type === a.type &&
    a.local_date <= t.covers_until &&
    (t.period_start === null || a.local_date >= t.period_start))
}

export interface ActivitySummary {
  sessions: CountByType
  totalSessions: number
  gymSessions: number
  footballSessions: number
  walkRunDistanceM: number
  runDistanceM: number
  walkDistanceM: number
  durationS: number
  steps: number
  /** Sessions contributed by historical totals (all-time only). */
  historicalSessions: number
  /** Dated activities not added because a historical total already covers them. */
  coveredActivities: number
}

export function summarize(
  activities: readonly ActivityFact[],
  range: DateRange,
  options: { totals?: readonly HistoricalTotal[]; dailySteps?: readonly DailySteps[] } = {},
): ActivitySummary {
  const allTime = range.from === null
  const totals = allTime ? (options.totals ?? []) : []
  const sessions = emptyCounts()
  let runDistanceM = 0
  let walkDistanceM = 0
  let durationS = 0
  let coveredActivities = 0
  let historicalSessions = 0

  for (const t of totals) {
    sessions[t.activity_type] += t.session_count
    historicalSessions += t.session_count
    if (t.activity_type === 'run') runDistanceM += t.total_distance_m ?? 0
    if (t.activity_type === 'walk') walkDistanceM += t.total_distance_m ?? 0
    durationS += t.total_duration_s ?? 0
  }

  const inPeriod = activities.filter((a) => inRange(a.local_date, range))
  for (const a of inPeriod) {
    if (allTime && isCoveredByTotal(a, totals)) {
      coveredActivities++
      continue
    }
    sessions[a.type]++
    if (a.type === 'run') runDistanceM += a.distance_m ?? 0
    if (a.type === 'walk') walkDistanceM += a.distance_m ?? 0
    durationS += a.duration_s ?? 0
  }

  return {
    sessions,
    totalSessions: Object.values(sessions).reduce((s, n) => s + n, 0),
    gymSessions: sessions.gym,
    footballSessions: sessions.football_training + sessions.football_match,
    walkRunDistanceM: runDistanceM + walkDistanceM,
    runDistanceM,
    walkDistanceM,
    durationS,
    steps: totalSteps(inPeriod, (options.dailySteps ?? []).filter((d) => inRange(d.date, range))),
    historicalSessions,
    coveredActivities,
  }
}

export function totalSteps(activities: readonly ActivityFact[], dailySteps: readonly DailySteps[]): number {
  const daysWithTotals = new Set(dailySteps.map((d) => d.date))
  let steps = dailySteps.reduce((s, d) => s + d.steps, 0)
  for (const a of activities) {
    if (a.steps != null && !daysWithTotals.has(a.local_date)) steps += a.steps
  }
  return steps
}

// ---------------------------------------------------------------------------
// Time buckets for charts. Only dated activities: historical totals are never
// spread over weeks or months.
// ---------------------------------------------------------------------------
export type Granularity = 'day' | 'week' | 'month'

export interface Bucket {
  /** First day of the bucket. */
  start: LocalDate
  counts: CountByType
  total: number
  durationS: number
  distanceM: number
}

export function bucketStart(d: LocalDate, g: Granularity): LocalDate {
  if (g === 'day') return d
  if (g === 'week') return startOfWeek(d)
  return startOfMonth(d)
}

function nextBucket(d: LocalDate, g: Granularity): LocalDate {
  if (g === 'day') return addDays(d, 1)
  if (g === 'week') return addDays(d, 7)
  return addMonths(d, 1)
}

/** Contiguous buckets from `from` to `to` (inclusive), empty ones included. */
export function bucketActivities(
  activities: readonly ActivityFact[],
  from: LocalDate,
  to: LocalDate,
  g: Granularity,
): Bucket[] {
  const buckets: Bucket[] = []
  const index = new Map<LocalDate, Bucket>()
  for (let d = bucketStart(from, g); d <= to; d = nextBucket(d, g)) {
    const b: Bucket = { start: d, counts: emptyCounts(), total: 0, durationS: 0, distanceM: 0 }
    buckets.push(b)
    index.set(d, b)
  }
  for (const a of activities) {
    if (a.local_date < from || a.local_date > to) continue
    const b = index.get(bucketStart(a.local_date, g))
    if (!b) continue
    b.counts[a.type]++
    b.total++
    b.durationS += a.duration_s ?? 0
    if (isWalkOrRun(a.type)) b.distanceM += a.distance_m ?? 0
  }
  return buckets
}

/** Sensible chart granularity and window for a statistics period. */
export function chartWindow(range: DateRange, firstActivity: LocalDate | null): { from: LocalDate; g: Granularity } {
  if (range.from === null) {
    const from = firstActivity ?? addMonths(range.to, -11)
    const g: Granularity = from >= addMonths(range.to, -3) ? 'week' : 'month'
    return { from, g }
  }
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000)
  return { from: range.from, g: days <= 31 ? (days <= 7 ? 'day' : 'week') : 'month' }
}

/** Distinct days with at least one activity in the last `days` days. */
export function activeDays(activities: readonly ActivityFact[], today: LocalDate, days = 7): number {
  const from = addDays(today, -(days - 1))
  return new Set(activities.filter((a) => a.local_date >= from && a.local_date <= today).map((a) => a.local_date)).size
}

/** Number of dated activities that a historical total covers (for warnings). */
export function activitiesCoveredBy(total: HistoricalTotal, activities: readonly ActivityFact[]): number {
  return activities.filter((a) => isCoveredByTotal(a, [total])).length
}
