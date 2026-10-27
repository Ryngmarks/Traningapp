import { describe, expect, it } from 'vitest'
import { estimatedOneRepMax, exerciseSnapshot, personalBests, sessionSummaries, suggestProgression, totalVolume } from './progression'
import type { CompletedSet, SetValues } from './types'

const w = (weight_kg: number | null, reps: number | null, kind: 'working' | 'warmup' = 'working'): SetValues =>
  ({ kind, weight_kg, reps, duration_s: null, distance_m: null })

describe('suggestProgression (double progression)', () => {
  it('suggests a cautious increase when every working set hit the top of the range', () => {
    const s = suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(40, 10, 'warmup'), w(60, 12), w(60, 12), w(60, 12)] }, 'weight_reps', 2.5)
    expect(s).toEqual({ kind: 'increase_weight', fromKg: 60, toKg: 62.5, reps: 8 })
  })

  it('ignores warm-up sets when judging the top of the range', () => {
    const s = suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(20, 5, 'warmup'), w(60, 12), w(60, 12)] }, 'weight_reps')
    expect(s?.kind).toBe('increase_weight')
  })

  it('asks for one more rep when inside the range', () => {
    expect(suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(60, 12), w(60, 10), w(60, 9)] }, 'weight_reps'))
      .toEqual({ kind: 'add_reps', targetReps: 10 })
  })

  it('holds when a set fell below the range', () => {
    expect(suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(60, 9), w(60, 7)] }, 'weight_reps')).toEqual({ kind: 'hold' })
  })

  it('does not increase when loads differed between sets', () => {
    expect(suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(60, 12), w(62.5, 12)] }, 'weight_reps'))
      .toEqual({ kind: 'add_reps', targetReps: 12 })
  })

  it('uses a smaller step for light loads', () => {
    const s = suggestProgression({ rep_min: 10, rep_max: 15, sets: [w(12, 15), w(12, 15)] }, 'weight_reps', 2.5)
    expect(s).toMatchObject({ toKg: 13 })
  })

  it('returns null without a rep range, history or for timed exercises', () => {
    expect(suggestProgression(null, 'weight_reps')).toBeNull()
    expect(suggestProgression({ rep_min: null, rep_max: null, sets: [w(60, 12)] }, 'weight_reps')).toBeNull()
    expect(suggestProgression({ rep_min: 8, rep_max: 12, sets: [w(60, 12)] }, 'duration')).toBeNull()
  })

  it('never suggests a weight increase for bodyweight work', () => {
    expect(suggestProgression({ rep_min: 6, rep_max: 10, sets: [w(null, 10), w(null, 10)] }, 'bodyweight_reps'))
      .toEqual({ kind: 'add_reps', targetReps: 10 })
  })
})

describe('volume and records', () => {
  it('counts only completed working sets with load', () => {
    expect(totalVolume([w(20, 10, 'warmup'), w(60, 10), w(60, 8), w(null, 10)])).toBe(1080)
  })

  it('estimates 1RM with Epley within 1–12 reps', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100)
    expect(estimatedOneRepMax(100, 10)).toBe(133.3)
    expect(estimatedOneRepMax(100, 15)).toBeNull()
    expect(estimatedOneRepMax(0, 5)).toBeNull()
  })

  const history: CompletedSet[] = [
    { ...w(60, 12), date: '2026-01-01', activityId: 'a' },
    { ...w(60, 12), date: '2026-01-01', activityId: 'a' },
    { ...w(70, 6), date: '2026-01-08', activityId: 'b' },
    { ...w(100, 3, 'warmup'), date: '2026-01-08', activityId: 'b' },
    { ...w(65, 10), date: '2026-01-15', activityId: 'c' },
  ]

  it('finds personal bests from working sets only', () => {
    const pb = personalBests(history)
    expect(pb.heaviest).toEqual({ weightKg: 70, reps: 6, date: '2026-01-08' })
    expect(pb.bestEstimated1RM).toMatchObject({ value: 86.7, weightKg: 65, reps: 10 })
    expect(pb.mostReps).toMatchObject({ reps: 12 })
    expect(pb.bestSessionVolume).toEqual({ volume: 1440, date: '2026-01-01' })
  })

  it('summarises sessions oldest first', () => {
    const s = sessionSummaries(history)
    expect(s.map((x) => [x.date, x.volume, x.topWeightKg])).toEqual([
      ['2026-01-01', 1440, 60], ['2026-01-08', 420, 70], ['2026-01-15', 650, 65],
    ])
  })
})

describe('exerciseSnapshot', () => {
  const set = (date: string, activityId: string, weight_kg: number | null, reps: number | null, kind: 'working' | 'warmup' = 'working'): CompletedSet =>
    ({ kind, weight_kg, reps, duration_s: null, distance_m: null, date, activityId })

  it('gives last session top weight, PB and the most used weight', () => {
    const history = [
      set('2026-09-01', 'a', 80, 10), set('2026-09-01', 'a', 80, 10), set('2026-09-01', 'a', 80, 9),
      set('2026-09-08', 'b', 102, 3), set('2026-09-08', 'b', 85, 8),
      set('2026-09-15', 'c', 120, 5, 'warmup'), set('2026-09-15', 'c', 81, 10), set('2026-09-15', 'c', 78, 12),
    ]
    expect(exerciseSnapshot(history, 'weight_reps')).toEqual({
      unit: 'kg', last: 81, best: 102, bestReps: 3, common: 80, sessions: 3,
    })
  })

  it('uses reps for bodyweight and distance for cardio', () => {
    expect(exerciseSnapshot([set('2026-09-01', 'a', null, 8), set('2026-09-02', 'b', null, 6)], 'bodyweight_reps'))
      .toMatchObject({ unit: 'reps', last: 6, best: 8, common: null })
    const run = (date: string, id: string, distance_m: number): CompletedSet =>
      ({ kind: 'working', weight_kg: null, reps: null, duration_s: 1800, distance_m, date, activityId: id })
    expect(exerciseSnapshot([run('2026-09-01', 'a', 6000), run('2026-09-05', 'b', 5200)], 'cardio'))
      .toMatchObject({ unit: 'metres', last: 5200, best: 6000 })
  })

  it('returns null without usable history', () => {
    expect(exerciseSnapshot([], 'weight_reps')).toBeNull()
    expect(exerciseSnapshot([set('2026-09-01', 'a', 40, 8, 'warmup')], 'weight_reps')).toBeNull()
  })
})
