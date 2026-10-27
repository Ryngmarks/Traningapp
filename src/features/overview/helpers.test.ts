import { describe, expect, it } from 'vitest'
import { greeting, lastDays, pickNextTemplate, weekdayShort } from './helpers'

const A = { id: 'a', name: 'Pass A' }
const B = { id: 'b', name: 'Pass B' }
const C = { id: 'c', name: 'Pass C' }

describe('pickNextTemplate', () => {
  it('returns null without templates', () => {
    expect(pickNextTemplate([], [])).toBeNull()
  })
  it('prefers a template never used', () => {
    expect(pickNextTemplate([A, B, C], [{ template_name: 'Pass A', local_date: '2026-10-20' }])).toBe(B)
  })
  it('otherwise picks the least recently used', () => {
    const sessions = [
      { template_name: 'Pass A', local_date: '2026-10-25' },
      { template_name: 'Pass B', local_date: '2026-10-22' },
      { template_name: 'Pass B', local_date: '2026-10-10' },
      { template_name: 'Pass A', local_date: '2026-10-01' },
      { template_name: null, local_date: '2026-01-01' },
    ]
    expect(pickNextTemplate([A, B], sessions)).toBe(B)
  })
})

describe('date helpers', () => {
  it('names weekdays', () => {
    expect(weekdayShort('2026-10-26')).toBe('mån')
    expect(weekdayShort('2026-11-01')).toBe('sön')
  })
  it('lists the last days oldest first', () => {
    expect(lastDays('2026-10-27', 3)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27'])
  })
  it('greets by time of day', () => {
    expect(greeting(7)).toBe('God morgon')
    expect(greeting(20)).toBe('God kväll')
  })
})
