import { describe, expect, it } from 'vitest'
import { periodRange } from './dates'
import { activeDays, bucketActivities, summarize, totalSteps } from './stats'
import type { ActivityFact, HistoricalTotal } from './types'

let n = 0
const act = (type: ActivityFact['type'], local_date: string, extra: Partial<ActivityFact> = {}): ActivityFact =>
  ({ id: `a${n++}`, type, local_date, duration_s: 3600, distance_m: null, steps: null, source: 'manual', ...extra })

const total = (extra: Partial<HistoricalTotal>): HistoricalTotal => ({
  id: 't', activity_type: 'gym', session_count: 110, total_distance_m: null, total_duration_s: null,
  period_start: null, covers_until: '2026-06-30', ...extra,
})

const activities = [
  act('gym', '2026-06-20'),                         // covered by the historical total
  act('gym', '2026-07-02'),
  act('gym', '2026-07-03'),
  act('football_match', '2026-07-04'),
  act('run', '2026-07-05', { distance_m: 5200 }),
  act('walk', '2026-07-05', { distance_m: 3100, steps: 4000 }),
]

describe('summarize', () => {
  it('adds historical totals only to the all-time view without double counting', () => {
    const s = summarize(activities, periodRange('all', '2026-07-05'), { totals: [total({})] })
    expect(s.gymSessions).toBe(112) // 110 historical + 2 after covers_until
    expect(s.coveredActivities).toBe(1)
    expect(s.historicalSessions).toBe(110)
    expect(s.totalSessions).toBe(115)
  })

  it('never spreads historical totals into a dated period', () => {
    const s = summarize(activities, periodRange('month', '2026-06-15'), { totals: [total({})] })
    expect(s.gymSessions).toBe(1)
    expect(s.historicalSessions).toBe(0)
  })

  it('respects period_start when deciding coverage', () => {
    const s = summarize(activities, periodRange('all', '2026-07-05'), {
      totals: [total({ period_start: '2026-06-25', session_count: 3 })],
    })
    expect(s.gymSessions).toBe(3 + 3)
    expect(s.coveredActivities).toBe(0)
  })

  it('sums walk and run distance separately and together', () => {
    const s = summarize(activities, periodRange('week', '2026-07-05'), {
      totals: [total({ activity_type: 'run', total_distance_m: 100_000, session_count: 20 })],
    })
    expect(s.runDistanceM).toBe(5200)
    expect(s.walkDistanceM).toBe(3100)
    expect(s.walkRunDistanceM).toBe(8300)
    expect(s.footballSessions).toBe(1)
  })

  it('includes historical distance in all-time totals', () => {
    const s = summarize(activities, periodRange('all', '2026-07-05'), {
      totals: [total({ activity_type: 'run', total_distance_m: 100_000, session_count: 20, covers_until: '2026-01-01' })],
    })
    expect(s.runDistanceM).toBe(105_200)
  })
})

describe('steps', () => {
  it('prefers daily totals and never adds activity steps on the same day', () => {
    const acts = [act('walk', '2026-07-05', { steps: 4000 }), act('walk', '2026-07-06', { steps: 2500 })]
    expect(totalSteps(acts, [{ date: '2026-07-05', steps: 11000 }])).toBe(13500)
  })
})

describe('buckets', () => {
  it('creates contiguous weekly buckets including empty weeks', () => {
    const b = bucketActivities(activities, '2026-06-15', '2026-07-05', 'week')
    // Week of Mon 29 Jun – Sun 5 Jul holds the five July activities.
    expect(b.map((x) => [x.start, x.total])).toEqual([['2026-06-15', 1], ['2026-06-22', 0], ['2026-06-29', 5]])
  })

  it('counts activities per day and distance only for walk/run', () => {
    const b = bucketActivities(activities, '2026-07-04', '2026-07-05', 'day')
    expect(b).toHaveLength(2)
    expect(b[1]).toMatchObject({ start: '2026-07-05', total: 2, distanceM: 8300 })
  })

  it('counts distinct active days', () => {
    expect(activeDays(activities, '2026-07-05', 7)).toBe(4)
  })
})
