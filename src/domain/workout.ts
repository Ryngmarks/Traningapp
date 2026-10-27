import type { MeasurementType, SetKind } from './types'

// Pure helpers for the active workout screen.

export interface WorkoutSet {
  id: string
  position: number
  kind: SetKind
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  speed_kmh?: number | null
  incline_pct?: number | null
  calories?: number | null
  completed_at: string | null
}

export interface WorkoutExercise {
  id: string
  position: number
  measurement_type: MeasurementType
  sets: WorkoutSet[]
}

export interface Progress {
  done: number
  planned: number
  /** 0..1 */
  ratio: number
}

export function workoutProgress(exercises: readonly WorkoutExercise[]): Progress {
  let done = 0
  let planned = 0
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.kind !== 'working') continue
      planned++
      if (s.completed_at) done++
    }
  }
  return { done, planned, ratio: planned === 0 ? 0 : done / planned }
}

/** First exercise (in order) that still has an unfinished set. */
export function currentExerciseId(exercises: readonly WorkoutExercise[]): string | null {
  const sorted = [...exercises].sort((a, b) => a.position - b.position)
  return sorted.find((e) => e.sets.some((s) => !s.completed_at))?.id ?? null
}

/** A set can be completed when it has the values its measurement needs. */
export function isSetReady(s: Pick<WorkoutSet, 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'>, m: MeasurementType): boolean {
  switch (m) {
    case 'weight_reps':
      return s.reps != null && s.reps > 0 && s.weight_kg != null
    case 'bodyweight_reps':
      return s.reps != null && s.reps > 0
    case 'duration':
      return s.duration_s != null && s.duration_s > 0
    case 'distance':
      return s.distance_m != null && s.distance_m > 0
    case 'cardio':
      // Machines show different values; time or distance is enough.
      return (s.duration_s != null && s.duration_s > 0) || (s.distance_m != null && s.distance_m > 0)
  }
}

/**
 * Values for a newly added set: copy the previous set of the same exercise so
 * "one more set" is a single tap.
 */
export function nextSetValues(sets: readonly WorkoutSet[], kind: SetKind = 'working') {
  const sorted = [...sets].sort((a, b) => a.position - b.position)
  const prev = [...sorted].reverse().find((s) => s.kind === kind) ?? sorted[sorted.length - 1]
  return {
    position: sorted.length === 0 ? 0 : sorted[sorted.length - 1]!.position + 1,
    kind,
    weight_kg: prev?.weight_kg ?? null,
    reps: prev?.reps ?? null,
    duration_s: prev?.duration_s ?? null,
    distance_m: prev?.distance_m ?? null,
    speed_kmh: prev?.speed_kmh ?? null,
    incline_pct: prev?.incline_pct ?? null,
    calories: prev?.calories ?? null,
  }
}

/** Elapsed seconds since an ISO instant, never negative. */
export function elapsedSeconds(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000))
}

/** Gap after the last completed set that suggests the workout was left running. */
export const FORGOTTEN_GAP_MS = 20 * 60_000
/** Time added after the last set (cool-down, last walk to the locker room). */
export const END_BUFFER_MS = 5 * 60_000

/**
 * When a workout was probably left running, a better end time: shortly after
 * the last completed set. Null when the workout looks current or has no sets.
 */
export function suggestedEndTime(sets: readonly Pick<WorkoutSet, 'completed_at'>[], nowMs: number): string | null {
  const times = sets.map((s) => (s.completed_at ? Date.parse(s.completed_at) : NaN)).filter((t) => Number.isFinite(t))
  if (times.length === 0) return null
  const last = Math.max(...times)
  if (nowMs - last < FORGOTTEN_GAP_MS) return null
  return new Date(Math.min(nowMs, last + END_BUFFER_MS)).toISOString()
}
