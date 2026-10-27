import { describe, expect, it } from 'vitest'
import { addMonths, isoWeek, periodRange, startOfWeek, toLocalDate } from './dates'

describe('dates', () => {
  it('uses Monday as the first day of the week', () => {
    expect(startOfWeek('2026-10-27')).toBe('2026-10-26')
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
  })

  it('computes ISO week numbers', () => {
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2026-10-27')).toBe(44)
    expect(isoWeek('2027-01-01')).toBe(53)
  })

  it('resolves the local calendar day in a timezone', () => {
    expect(toLocalDate(new Date('2026-03-01T23:30:00Z'), 'Europe/Stockholm')).toBe('2026-03-02')
    expect(toLocalDate(new Date('2026-03-01T23:30:00Z'), 'UTC')).toBe('2026-03-01')
  })

  it('builds calendar periods', () => {
    expect(periodRange('week', '2026-10-27')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(periodRange('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange('year', '2026-02-10')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', '2026-02-10')).toEqual({ from: null, to: '2026-02-10' })
  })

  it('adds months from the first of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })
})
