import { describe, expect, it } from 'vitest'
import { periodRange } from '@/domain/dates'
import { bucketLabels, historicalSummary, periodTitle, shiftAnchor } from './helpers'

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
