import { describe, expect, it } from 'vitest'
import type { HistoricalTotalRow } from '@/data/totals'
import { emptyTotalForm, importKind, parseTotalForm, passwordError, timezoneLabel, timezoneOptions, totalToForm } from './helpers'

describe('timezones', () => {
  it('includes the current zone and sorts', () => {
    expect(timezoneOptions('Mars/Base', ['Europe/Stockholm', 'America/New_York'])).toEqual(['America/New_York', 'Europe/Stockholm', 'Mars/Base'])
    expect(timezoneOptions('Europe/Stockholm')).toContain('Europe/Stockholm')
  })
  it('labels zones', () => {
    expect(timezoneLabel('Europe/Stockholm')).toBe('Stockholm (Europe)')
    expect(timezoneLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires (America/Argentina)')
    expect(timezoneLabel('UTC')).toBe('UTC')
  })
})

describe('passwordError', () => {
  it('validates length and confirmation', () => {
    expect(passwordError('short', 'short')).toBe('Minst 8 tecken')
    expect(passwordError('longenough', 'different')).toBe('Lösenorden matchar inte')
    expect(passwordError('longenough', 'longenough')).toBeNull()
  })
})

describe('historical total form', () => {
  it('converts km and hours and trims text', () => {
    const r = parseTotalForm({ ...emptyTotalForm('2026-06-30'), count: '110', km: '12,5', hours: '1,5', source_label: ' Strava ' })
    expect(r).toEqual({
      ok: true,
      input: {
        activity_type: 'gym', session_count: 110, total_distance_m: 12500, total_duration_s: 5400,
        period_start: null, covers_until: '2026-06-30', source_label: 'Strava', notes: null,
      },
    })
  })
  it('reports field errors', () => {
    const r = parseTotalForm({ ...emptyTotalForm(''), count: 'x', km: '-1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['count', 'covers_until', 'km'])
  })
  it('maps schema errors to fields', () => {
    const r = parseTotalForm({ ...emptyTotalForm('2026-01-01'), count: '3', period_start: '2026-02-01' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.period_start).toBe('Startdatum måste vara före slutdatum')
  })
  it('round-trips a stored row', () => {
    const row: HistoricalTotalRow = {
      id: '1', user_id: 'u', activity_type: 'run', session_count: 40, total_distance_m: 201_300, total_duration_s: 72_000,
      period_start: '2025-01-01', covers_until: '2025-12-31', source_label: null, notes: 'x', created_at: '', updated_at: '',
    }
    const f = totalToForm(row)
    expect(f.km).toBe('201,3')
    expect(f.hours).toBe('20')
    const r = parseTotalForm(f)
    expect(r.ok && r.input.total_distance_m).toBe(201_300)
  })
})

describe('importKind', () => {
  it('detects csv and json', () => {
    expect(importKind('Träning.CSV')).toBe('csv')
    expect(importKind('a.json')).toBe('json')
    expect(importKind('a.txt')).toBeNull()
  })
})
