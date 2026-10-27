// Domain types shared by the business logic. Deliberately independent of the
// generated database types so the logic stays testable without Supabase.

export const ACTIVITY_TYPES = ['gym', 'football_training', 'football_match', 'walk', 'run', 'other'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

// Display order. upper_body is kept for exercises created before the
// chest/back/shoulders/arms split.
export const EXERCISE_CATEGORIES = [
  'legs', 'hamstrings', 'chest', 'back', 'shoulders', 'arms', 'core', 'hip_groin',
  'explosive', 'mobility', 'conditioning', 'upper_body',
] as const
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]

export const MEASUREMENT_TYPES = ['weight_reps', 'bodyweight_reps', 'duration', 'distance'] as const
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]

export type SetKind = 'warmup' | 'working'

export const DATA_SOURCES = ['manual', 'import_csv', 'import_json', 'apple_health', 'other'] as const
export type DataSource = (typeof DATA_SOURCES)[number]

/** ISO calendar date in the user's local timezone, e.g. "2026-10-27". */
export type LocalDate = string

export interface SetValues {
  kind: SetKind
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
}

export interface CompletedSet extends SetValues {
  /** Local date of the workout the set belongs to. */
  date: LocalDate
  activityId: string
}

/** Minimal activity shape the statistics need. */
export interface ActivityFact {
  id: string
  type: ActivityType
  local_date: LocalDate
  duration_s: number | null
  distance_m: number | null
  steps: number | null
  source: DataSource
}

export interface HistoricalTotal {
  id: string
  activity_type: ActivityType
  session_count: number
  total_distance_m: number | null
  total_duration_s: number | null
  period_start: LocalDate | null
  covers_until: LocalDate
}

export interface DailySteps {
  date: LocalDate
  steps: number
}
