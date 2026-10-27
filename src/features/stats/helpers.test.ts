import { describe, expect, it } from 'vitest'
import { periodRange } from '@/domain/dates'
import {
  bucketLabels, firstActivityDate, historicalSummary, isLatestPeriod, parseAnchor, periodTitle, shiftAnchor, trainedExercises, typeRows,
} from './helpers'

describe('shiftAnchor', () => {
  it('moves by week, month and year', () => {
    expect(shiftAnchor('week', '2026-10-27', -1)).toBe('2026-10-20')
    expect(shiftAnchor('month', '2026-01-31', -1)).toBe('2025-12-01')
    expect(shiftAnchor('month', '2026-10-27', 1)).toBe('2026-11-01')
    expect(shiftAnchor('year', '2026-10-27', -1)).toBe('2025-01-01')
  })
})

describe('periodTitle', () => {
  it('names each period', () => {
    expect(periodTitle('week', periodRange('week', '2026-10-27')).title).toBe('Vecka 44')
    expect(periodTitle('month', periodRange('month', '2026-10-27')).title).toBe('Oktober 2026')
    expect(periodTitle('year', periodRange('year', '2026-10-27')).title).toBe('2026')
    expect(periodTitle('all', periodRange('all', '2026-10-27')).title).toBe('Hela tiden')
  })
})

describe('bucketLabels', () => {
  it('labels days, weeks and months', () => {
    expect(bucketLabels('2026-10-26', 'day', false).label).toBe('mån')
    expect(bucketLabels('2026-10-26', 'week', false).label).toBe('v44')
    expect(bucketLabels('2026-01-01', 'month', true).label).toMatch(/^jan 26$/)
    expect(bucketLabels('2026-02-01', 'month', true).label).toBe('feb')
  })
})

describe('historicalSummary', () => {
  it('sums per type and joins in Swedish', () => {
    expect(historicalSummary([{ activity_type: 'gym', session_count: 110 }])).toBe('110 gympass')
    expect(historicalSummary([
      { activity_type: 'gym', session_count: 100 },
      { activity_type: 'gym', session_count: 10 },
      { activity_type: 'football_match', session_count: 1 },
      { activity_type: 'run', session_count: 0 },
    ])).toBe('110 gympass och 1 match')
  })
})

describe('period navigation', () => {
  it('parses the anchor from the URL', () => {
    expect(parseAnchor('2026-03-04', '2026-10-27')).toBe('2026-03-04')
    expect(parseAnchor('2027-01-01', '2026-10-27')).toBe('2026-10-27')
    expect(parseAnchor('nonsense', '2026-10-27')).toBe('2026-10-27')
    expect(parseAnchor(null, '2026-10-27')).toBe('2026-10-27')
  })
  it('knows when the next period is in the future', () => {
    expect(isLatestPeriod('week', '2026-10-27', '2026-10-27')).toBe(true)
    expect(isLatestPeriod('week', '2026-10-20', '2026-10-27')).toBe(false)
    expect(isLatestPeriod('month', '2026-10-01', '2026-10-27')).toBe(true)
    expect(isLatestPeriod('month', '2026-09-30', '2026-10-27')).toBe(false)
    expect(isLatestPeriod('year', '2025-06-01', '2026-10-27')).toBe(false)
    expect(isLatestPeriod('year', '2026-01-01', '2026-10-27')).toBe(true)
  })
})

describe('summary helpers', () => {
  it('finds the first activity date', () => {
    expect(firstActivityDate([])).toBeNull()
    expect(firstActivityDate([{ local_date: '2026-05-01' }, { local_date: '2025-01-02' }])).toBe('2025-01-02')
  })
  it('lists non-zero types, largest first', () => {
    expect(typeRows({ gym: 3, football_training: 5, football_match: 0, walk: 3, run: 0, other: 0 }))
      .toEqual([{ type: 'football_training', count: 5 }, { type: 'gym', count: 3 }, { type: 'walk', count: 3 }])
  })
  it('resolves trained exercises sorted by Swedish name', () => {
    const library = [{ id: '1', name: 'Översträck' }, { id: '2', name: 'Knäböj (ny)' }, { id: '3', name: 'Axelpress' }]
    const trained = [{ id: '1', name: 'Översträck' }, { id: '2', name: 'Knäböj' }, { id: 'x', name: 'Arkiverad' }]
    // Library name wins (renamed); archived exercises fall back to the history snapshot.
    expect(trainedExercises(trained, library).map((e) => e.name)).toEqual(['Arkiverad', 'Knäböj (ny)', 'Översträck'])
  })
})
