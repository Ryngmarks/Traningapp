import { addDays, parseLocalDate } from '@/domain/dates'
import type { LocalDate } from '@/domain/types'

/**
 * The template to suggest next: one never used yet (in list order), else the
 * one whose latest completed session is the oldest. Sessions reference the
 * template by its snapshot name.
 */
export function pickNextTemplate<T extends { id: string; name: string }>(
  templates: readonly T[],
  gymSessions: readonly { template_name: string | null; local_date: LocalDate }[],
): T | null {
  if (templates.length === 0) return null
  const last = new Map<string, LocalDate>()
  for (const s of gymSessions) {
    if (!s.template_name) continue
    const cur = last.get(s.template_name)
    if (!cur || s.local_date > cur) last.set(s.template_name, s.local_date)
  }
  let best: T | null = null
  let bestDate: LocalDate | null = null
  for (const t of templates) {
    const d = last.get(t.name)
    if (d == null) return t
    if (bestDate == null || d < bestDate) { best = t; bestDate = d }
  }
  return best
}

export function greeting(hour: number): string {
  if (hour < 5) return 'God natt'
  if (hour < 10) return 'God morgon'
  if (hour < 17) return 'Hej'
  return 'God kväll'
}

const WEEKDAY = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'] as const

/** Short Swedish weekday for a local date ("mån" … "sön"). */
export function weekdayShort(d: LocalDate): string {
  return WEEKDAY[(parseLocalDate(d).getUTCDay() + 6) % 7]!
}

/** The last `n` days ending today, oldest first. */
export function lastDays(today: LocalDate, n: number): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)))
}
