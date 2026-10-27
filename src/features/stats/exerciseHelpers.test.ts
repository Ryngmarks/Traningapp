import { describe, expect, it } from 'vitest'
import type { CompletedSet } from '@/domain/types'
import { groupSessions, inferMeasurement, sessionBest, setsLine } from './exerciseHelpers'

const set = (p: Partial<CompletedSet>): CompletedSet => ({
  kind: 'working', weight_kg: null, reps: null, duration_s: null, distance_m: null, date: '2026-10-01', activityId: 'a', ...p,
})

describe('groupSessions', () => {
  it('groups working sets per workout, newest first', () => {
    const s = groupSessions([
      set({ activityId: 'a', date: '2026-10-01', reps: 8 }),
      set({ activityId: 'a', date: '2026-10-01', kind: 'warmup', reps: 10 }),
      set({ activityId: 'b', date: '2026-10-08', reps: 9 }),
      set({ activityId: 'c', date: '2026-10-09', kind: 'warmup', reps: 5 }),
    ])
    expect(s.map((x) => x.activityId)).toEqual(['b', 'a'])
    expect(s[1]!.sets).toHaveLength(1)
  })
})

describe('setsLine', () => {
  it('merges consecutive sets with the same load', () => {
    expect(setsLine([
      set({ weight_kg: 60, reps: 8 }), set({ weight_kg: 60, reps: 8 }), set({ weight_kg: 62.5, reps: 6 }),
    ], 'weight_reps')).toBe('60 kg × 8, 8 · 62,5 kg × 6')
  })
  it('formats bodyweight, duration and distance', () => {
    expect(setsLine([set({ reps: 12 }), set({ reps: 10 })], 'bodyweight_reps')).toBe('12, 10 reps')
    expect(setsLine([set({ reps: 8, weight_kg: 10 })], 'bodyweight_reps')).toBe('+10 kg × 8')
    expect(setsLine([set({ duration_s: 90 })], 'duration')).toBe('1:30')
    expect(setsLine([set({ distance_m: 1500 })], 'distance')).toBe('1,5 km')
  })
})

describe('inferMeasurement and sessionBest', () => {
  it('infers from logged values', () => {
    expect(inferMeasurement([set({ weight_kg: 40, reps: 5 })])).toBe('weight_reps')
    expect(inferMeasurement([set({ reps: 5 })])).toBe('bodyweight_reps')
    expect(inferMeasurement([set({ duration_s: 30 })])).toBe('duration')
  })
  it('finds the best set of a session', () => {
    const [s] = groupSessions([set({ duration_s: 30 }), set({ duration_s: 45 }), set({})])
    expect(sessionBest(s!, 'duration')).toBe(45)
    expect(sessionBest(s!, 'distance')).toBeNull()
  })
})
