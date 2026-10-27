import type { HistoricalTotalRow } from '@/data/totals'
import type { ActivityType, LocalDate } from '@/domain/types'
import { type HistoricalTotalInput, historicalTotalSchema, parseNumberInput } from '@/domain/validation'

// Pure helpers for the settings screens.

export const WEIGHT_INCREMENTS = [1, 1.25, 2.5, 5] as const

const FALLBACK_ZONES = ['Europe/Stockholm', 'Europe/London', 'Europe/Berlin', 'Europe/Helsinki', 'UTC']

/** IANA zones for the picker, always including the current one, sorted. */
export function timezoneOptions(current: string, supported?: readonly string[]): string[] {
  let zones: readonly string[] = supported ?? []
  if (!supported) {
    try { zones = Intl.supportedValuesOf('timeZone') } catch { zones = FALLBACK_ZONES }
  }
  const set = new Set(zones.length > 0 ? zones : FALLBACK_ZONES)
  if (current) set.add(current)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** "Europe/Stockholm" → "Stockholm (Europe)". */
export function timezoneLabel(zone: string): string {
  const parts = zone.split('/')
  if (parts.length < 2) return zone
  const city = parts[parts.length - 1]!.replace(/_/g, ' ')
  return `${city} (${parts.slice(0, -1).join('/').replace(/_/g, ' ')})`
}

/** Swedish validation message for a new password, or null when acceptable. */
export function passwordError(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Minst 8 tecken'
  if (password.length > 72) return 'Högst 72 tecken'
  if (password !== confirm) return 'Lösenorden matchar inte'
  return null
}

// ---------------------------------------------------------------------------
// Historical total form
// ---------------------------------------------------------------------------

export interface TotalForm {
  activity_type: ActivityType
  count: string
  km: string
  hours: string
  period_start: string
  covers_until: string
  source_label: string
  notes: string
}

export function emptyTotalForm(today: LocalDate): TotalForm {
  return { activity_type: 'gym', count: '', km: '', hours: '', period_start: '', covers_until: today, source_label: '', notes: '' }
}

const decimal = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

export function totalToForm(t: HistoricalTotalRow): TotalForm {
  return {
    activity_type: t.activity_type,
    count: String(t.session_count),
    km: t.total_distance_m != null ? decimal(t.total_distance_m / 1000) : '',
    hours: t.total_duration_s != null ? decimal(t.total_duration_s / 3600) : '',
    period_start: t.period_start ?? '',
    covers_until: t.covers_until,
    source_label: t.source_label ?? '',
    notes: t.notes ?? '',
  }
}

export type TotalFormResult =
  | { ok: true; input: HistoricalTotalInput }
  | { ok: false; errors: Partial<Record<keyof TotalForm | 'form', string>> }

const FIELD_OF: Record<string, keyof TotalForm> = {
  session_count: 'count', total_distance_m: 'km', total_duration_s: 'hours',
  period_start: 'period_start', covers_until: 'covers_until', source_label: 'source_label', notes: 'notes',
}

/** Typed strings → validated input (km → m, hours → s). */
export function parseTotalForm(f: TotalForm): TotalFormResult {
  const errors: Partial<Record<keyof TotalForm | 'form', string>> = {}
  const count = parseNumberInput(f.count)
  if (count == null || !Number.isInteger(count) || count < 0) errors.count = 'Ange antal pass'
  const km = parseNumberInput(f.km)
  if (f.km.trim() !== '' && (km == null || km < 0)) errors.km = 'Ogiltig distans'
  const hours = parseNumberInput(f.hours)
  if (f.hours.trim() !== '' && (hours == null || hours < 0)) errors.hours = 'Ogiltig tid'
  if (!f.covers_until) errors.covers_until = 'Ange ett datum'
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const parsed = historicalTotalSchema.safeParse({
    activity_type: f.activity_type,
    session_count: count,
    total_distance_m: km == null ? null : Math.round(km * 1000),
    total_duration_s: hours == null ? null : Math.round(hours * 3600),
    period_start: f.period_start || null,
    covers_until: f.covers_until,
    source_label: f.source_label.trim() || null,
    notes: f.notes.trim() || null,
  })
  if (parsed.success) return { ok: true, input: parsed.data }
  for (const issue of parsed.error.issues) {
    const k = FIELD_OF[String(issue.path[0] ?? '')] ?? 'form'
    errors[k] ??= issue.message
  }
  return { ok: false, errors }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** File kind from its name, or null when unsupported. */
export function importKind(fileName: string): 'csv' | 'json' | null {
  const ext = fileName.toLowerCase().split('.').pop()
  return ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : null
}
