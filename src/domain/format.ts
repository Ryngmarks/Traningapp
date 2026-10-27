import { parseLocalDate } from './dates'
import type { ActivityType, DataSource, ExerciseCategory, MeasurementType } from './types'

// Swedish presentation helpers. All player-facing text lives in Swedish.

const nf1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

export const formatNumber = (n: number) => nf0.format(n)

export function formatWeight(kg: number | null | undefined): string {
  return kg == null ? '–' : `${nf2.format(kg)} kg`
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return '–'
  if (m < 1000) return `${nf0.format(m)} m`
  return `${nf1.format(m / 1000)} km`
}

/** 3725 → "1 h 2 min", 95 → "1:35" when short. */
export function formatDuration(s: number | null | undefined, style: 'long' | 'clock' = 'long'): string {
  if (s == null) return '–'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  if (style === 'clock') {
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`
  }
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  if (m > 0) return `${m} min`
  return `${sec} s`
}

/** Pace in min/km, or null when not computable. */
export function paceSecondsPerKm(distanceM: number | null | undefined, durationS: number | null | undefined): number | null {
  if (!distanceM || !durationS || distanceM <= 0 || durationS <= 0) return null
  return durationS / (distanceM / 1000)
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '–'
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`
}

const dayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('sv-SE', { month: 'short', timeZone: 'UTC' })
const longFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export const formatDay = (d: string) => dayFmt.format(parseLocalDate(d))
export const formatShortDate = (d: string) => shortFmt.format(parseLocalDate(d))
export const formatMonth = (d: string) => monthFmt.format(parseLocalDate(d)).replace('.', '')
export const formatLongDate = (d: string) => longFmt.format(parseLocalDate(d))

/** "i dag", "i går", "3 dagar sedan", else a short date. */
export function formatRelativeDay(d: string, today: string): string {
  const diff = Math.round((parseLocalDate(today).getTime() - parseLocalDate(d).getTime()) / 86_400_000)
  if (diff === 0) return 'i dag'
  if (diff === 1) return 'i går'
  if (diff > 1 && diff < 7) return `${diff} dagar sedan`
  return formatShortDate(d)
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  gym: 'Gym',
  football_training: 'Fotbollsträning',
  football_match: 'Fotbollsmatch',
  walk: 'Promenad',
  run: 'Löpning',
  other: 'Övrigt',
}

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  legs: 'Ben',
  hamstrings: 'Baksida och säte',
  chest: 'Bröst',
  back: 'Rygg',
  shoulders: 'Axlar',
  arms: 'Armar',
  hip_groin: 'Höft och ljumske',
  core: 'Bål och stabilitet',
  explosive: 'Explosivitet',
  mobility: 'Rörlighet',
  upper_body: 'Övrig överkropp',
  conditioning: 'Kondition',
}

export const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  weight_reps: 'Vikt × reps',
  bodyweight_reps: 'Kroppsvikt × reps',
  duration: 'Tid',
  distance: 'Distans',
  cardio: 'Tid, km, km/h, lutning, kcal',
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  manual: 'Manuell',
  import_csv: 'CSV-import',
  import_json: 'JSON-import',
  apple_health: 'Apple Hälsa',
  other: 'Annan källa',
}

/** "32 min · 5,2 km · 10 km/h · 2 % · 320 kcal" with whatever values a cardio set has. */
export function formatCardio(s: {
  duration_s: number | null; distance_m: number | null
  speed_kmh?: number | null; incline_pct?: number | null; calories?: number | null
}): string {
  const parts = [
    s.duration_s != null ? formatDuration(s.duration_s) : null,
    s.distance_m != null ? formatDistance(s.distance_m) : null,
    s.speed_kmh != null ? `${nf1.format(s.speed_kmh)} km/h` : null,
    s.incline_pct != null ? `${nf1.format(s.incline_pct)} % lutning` : null,
    s.calories != null ? `${nf0.format(s.calories)} kcal` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '–'
}
