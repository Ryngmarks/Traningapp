import type { LocalDate } from './types'

// Calendar arithmetic on ISO dates ("YYYY-MM-DD") without timezone drift:
// all math happens in UTC on date-only values.

const DAY_MS = 86_400_000

export function parseLocalDate(d: LocalDate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, day!))
}

export function formatLocalDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: LocalDate, days: number): LocalDate {
  return formatLocalDate(new Date(parseLocalDate(d).getTime() + days * DAY_MS))
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / DAY_MS)
}

/** Local calendar date of an instant in an IANA timezone. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
}

/** Monday of the ISO week containing d. */
export function startOfWeek(d: LocalDate): LocalDate {
  const dow = (parseLocalDate(d).getUTCDay() + 6) % 7 // Monday = 0
  return addDays(d, -dow)
}

export function startOfMonth(d: LocalDate): LocalDate {
  return `${d.slice(0, 7)}-01`
}

export function startOfYear(d: LocalDate): LocalDate {
  return `${d.slice(0, 4)}-01-01`
}

export function addMonths(d: LocalDate, months: number): LocalDate {
  const date = parseLocalDate(startOfMonth(d))
  date.setUTCMonth(date.getUTCMonth() + months)
  return formatLocalDate(date)
}

/** ISO 8601 week number. */
export function isoWeek(d: LocalDate): number {
  const date = parseLocalDate(d)
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * DAY_MS)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1
}

export type Period = 'week' | 'month' | 'year' | 'all'

export interface DateRange {
  /** Inclusive; null = unbounded. */
  from: LocalDate | null
  /** Inclusive. */
  to: LocalDate
}

/** The current calendar period containing `today`. */
export function periodRange(period: Period, today: LocalDate): DateRange {
  switch (period) {
    case 'week':
      return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
    case 'month':
      return { from: startOfMonth(today), to: addDays(addMonths(today, 1), -1) }
    case 'year':
      return { from: startOfYear(today), to: `${today.slice(0, 4)}-12-31` }
    case 'all':
      return { from: null, to: today }
  }
}

export function inRange(d: LocalDate, range: DateRange): boolean {
  return (range.from === null || d >= range.from) && d <= range.to
}
