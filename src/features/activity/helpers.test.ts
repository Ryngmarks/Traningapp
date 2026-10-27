import { describe, expect, it } from 'vitest'
import { activityTitle, durationToInput, groupByWeek, matchesFilter, parseDurationInput, weekRangeLabel, zonedIso, zonedParts } from './helpers'

describe('activityTitle', () => {
  it('prefers the template name for gym sessions', () => {
    expect(activityTitle({ type: 'gym', title: null, template_name: 'Pass A' })).toBe('Pass A')
    expect(activityTitle({ type: 'gym', title: null, template_name: null })).toBe('Gympass')
  })
  it('falls back to the type label', () => {
    expect(activityTitle({ type: 'run', title: '  ', template_name: null })).toBe('Löpning')
    expect(activityTitle({ type: 'other', title: 'Padel', template_name: null })).toBe('Padel')
  })
})

describe('groupByWeek', () => {
  it('groups newest-first rows by ISO week', () => {
    const groups = groupByWeek([
      { local_date: '2026-10-27' }, { local_date: '2026-10-26' }, { local_date: '2026-10-25' }, { local_date: '2026-01-01' },
    ])
    expect(groups.map((g) => [g.weekStart, g.week, g.items.length])).toEqual([
      ['2026-10-26', 44, 2], ['2026-10-19', 43, 1], ['2025-12-29', 1, 1],
    ])
  })
  it('labels a week range and adds the year when it differs', () => {
    expect(weekRangeLabel('2026-10-26', '2026-10-27')).toMatch(/^26 okt.* – 1 nov/)
    expect(weekRangeLabel('2025-10-20', '2026-10-27')).toMatch(/2025$/)
    expect(weekRangeLabel('2026-10-26', '2026-10-27')).not.toMatch(/2026$/)
  })
})

describe('matchesFilter', () => {
  it('groups football training and matches', () => {
    expect(matchesFilter('football_match', 'football')).toBe(true)
    expect(matchesFilter('football_training', 'football')).toBe(true)
    expect(matchesFilter('run', 'walk')).toBe(false)
    expect(matchesFilter('run', 'all')).toBe(true)
  })
})

describe('parseDurationInput', () => {
  it('reads minutes with a decimal comma', () => {
    expect(parseDurationInput('45')).toBe(2700)
    expect(parseDurationInput('27,5')).toBe(1650)
  })
  it('reads min:sec and h:min:sec', () => {
    expect(parseDurationInput('27:30')).toBe(1650)
    expect(parseDurationInput('1:05:00')).toBe(3900)
  })
  it('rejects garbage', () => {
    expect(parseDurationInput('')).toBeNull()
    expect(parseDurationInput('abc')).toBeNull()
    expect(parseDurationInput('10:75')).toBeNull()
    expect(parseDurationInput('-5')).toBeNull()
  })
  it('round-trips through durationToInput', () => {
    for (const s of [2700, 1650, 3900, 5400]) expect(parseDurationInput(durationToInput(s))).toBe(s)
  })
})

describe('zonedIso / zonedParts', () => {
  it('uses the zone offset for that date (winter and summer time)', () => {
    expect(zonedIso('2026-10-27', '18:30', 'Europe/Stockholm')).toBe('2026-10-27T18:30:00+01:00')
    expect(zonedIso('2026-07-01', '07:05', 'Europe/Stockholm')).toBe('2026-07-01T07:05:00+02:00')
    expect(zonedIso('2026-07-01', '07:05', 'America/New_York')).toBe('2026-07-01T07:05:00-04:00')
    expect(zonedIso('2026-07-01', '07:05', 'UTC')).toBe('2026-07-01T07:05:00+00:00')
  })
  it('round-trips', () => {
    const iso = zonedIso('2026-03-29', '23:15', 'Europe/Stockholm')
    expect(zonedParts(iso, 'Europe/Stockholm')).toEqual({ date: '2026-03-29', time: '23:15' })
  })
})
