import { describe, expect, it } from 'vitest'
import type { PerformedSet } from '@/data/workout'
import { missingFields, setFields, shownValue, stepValue, storedValue } from './setFields'

const cardio = setFields('cardio', 2.5)
const field = (key: string) => cardio.find((f) => f.key === key)!

describe('cardio set fields', () => {
  it('shows time in minutes and distance in km, stores seconds and metres', () => {
    expect(shownValue(1950, field('duration_s'))).toBe(32.5)
    expect(storedValue(32.5, field('duration_s'))).toBe(1950)
    expect(shownValue(5200, field('distance_m'))).toBe(5.2)
    expect(storedValue(5.2, field('distance_m'))).toBe(5200)
    expect(shownValue(10.5, field('speed_kmh'))).toBe(10.5)
  })

  it('steps in shown units', () => {
    expect(stepValue(5200, field('distance_m'), 1)).toBe(5300)
    expect(stepValue(1800, field('duration_s'), -1)).toBe(1740)
    expect(stepValue(null, field('speed_kmh'), 1)).toBe(0.5)
  })

  it('needs time or distance; speed, incline and calories are optional extras', () => {
    expect(cardio.filter((f) => f.secondary).map((f) => f.key)).toEqual(['speed_kmh', 'incline_pct', 'calories'])
    const empty = { duration_s: null, distance_m: null, speed_kmh: 10, incline_pct: null, calories: null } as unknown as PerformedSet
    expect(missingFields(empty, cardio)).toEqual(['duration_s', 'distance_m'])
    expect(missingFields({ ...empty, duration_s: 600 }, cardio)).toEqual([])
  })
})
