import { addDays, isoWeek, startOfWeek } from '@/domain/dates'
import { ACTIVITY_LABEL, formatShortDate } from '@/domain/format'
import type { ActivityType, LocalDate } from '@/domain/types'
import { parseNumberInput } from '@/domain/validation'

// Pure helpers for the activity screens.

export function activityTitle(a: { type: ActivityType; title: string | null; template_name: string | null }): string {
  if (a.type === 'gym') return a.template_name ?? a.title ?? 'Gympass'
  return a.title?.trim() || ACTIVITY_LABEL[a.type]
}

export interface WeekGroup<T> {
  weekStart: LocalDate
  week: number
  items: T[]
}

/** Group rows (already sorted newest first) by ISO week, keeping order. */
export function groupByWeek<T extends { local_date: LocalDate }>(rows: readonly T[]): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = []
  for (const r of rows) {
    const ws = startOfWeek(r.local_date)
    let g = groups[groups.length - 1]
    if (!g || g.weekStart !== ws) {
      g = { weekStart: ws, week: isoWeek(r.local_date), items: [] }
      groups.push(g)
    }
    g.items.push(r)
  }
  return groups
}

/** "26 okt – 1 nov", with the year when it differs from today's. */
export function weekRangeLabel(weekStart: LocalDate, today: LocalDate): string {
  const end = addDays(weekStart, 6)
  const label = `${formatShortDate(weekStart)} – ${formatShortDate(end)}`
  return end.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${end.slice(0, 4)}`
}

/** Filter chips on the activity list. Football covers training and matches. */
export type ActivityFilter = 'all' | 'gym' | 'football' | 'run' | 'walk' | 'other'

export function matchesFilter(type: ActivityType, f: ActivityFilter): boolean {
  if (f === 'all') return true
  if (f === 'football') return type === 'football_training' || type === 'football_match'
  return type === f
}

/**
 * Duration typed by the user, in seconds. "45" or "45,5" are minutes,
 * "27:30" is min:sec and "1:05:00" is h:min:sec.
 */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  if (s.includes(':')) {
    const parts = s.split(':')
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p.trim()))) return null
    const nums = parts.map((p) => Number(p.trim()))
    const [h, m, sec] = nums.length === 3 ? nums : [0, nums[0]!, nums[1]!]
    if (m! >= 60 && nums.length === 3) return null
    if (sec! >= 60) return null
    return h! * 3600 + m! * 60 + sec!
  }
  const min = parseNumberInput(s)
  if (min == null || min < 0) return null
  return Math.round(min * 60)
}

/** Offset of an IANA zone at an instant, in minutes east of UTC. */
export function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instantMs)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
  if (!m) return 0
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return m[1] === '-' ? -mins : mins
}

function formatOffset(min: number): string {
  const sign = min < 0 ? '-' : '+'
  const abs = Math.abs(min)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/** "2026-10-27" + "18:30" in Europe/Stockholm → "2026-10-27T18:30:00+01:00". */
export function zonedIso(date: LocalDate, time: string, timeZone: string): string {
  const naive = Date.parse(`${date}T${time}:00Z`)
  let off = zoneOffsetMinutes(naive, timeZone)
  off = zoneOffsetMinutes(naive - off * 60_000, timeZone)
  return `${date}T${time}:00${formatOffset(off)}`
}

/** Local date and HH:mm of an instant in a timezone. */
export function zonedParts(instant: string | number, timeZone: string): { date: LocalDate; time: string } {
  const d = new Date(instant)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
  return { date, time }
}

/** Duration seconds → the string shown in the custom duration field. */
export function durationToInput(s: number): string {
  if (s % 60 === 0) return String(s / 60)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}
