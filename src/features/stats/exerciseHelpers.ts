import { formatDistance, formatDuration } from '@/domain/format'
import type { CompletedSet, LocalDate, MeasurementType } from '@/domain/types'

// Pure helpers for the per-exercise statistics screen. Numbers come from
// src/domain/progression (personalBests, sessionSummaries); these only group
// and format sets for display.

export interface ExerciseSession {
  activityId: string
  date: LocalDate
  /** Working sets in logged order. */
  sets: CompletedSet[]
}

/** Working sets grouped per workout, newest first. Sessions without working sets are dropped. */
export function groupSessions(history: readonly CompletedSet[]): ExerciseSession[] {
  const map = new Map<string, ExerciseSession>()
  for (const s of history) {
    if (s.kind !== 'working') continue
    let session = map.get(s.activityId)
    if (!session) {
      session = { activityId: s.activityId, date: s.date, sets: [] }
      map.set(s.activityId, session)
    }
    session.sets.push(s)
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Best guess of how an exercise is measured when the library row is unavailable. */
export function inferMeasurement(history: readonly CompletedSet[]): MeasurementType {
  const work = history.filter((s) => s.kind === 'working')
  if (work.some((s) => s.reps != null && s.weight_kg != null && s.weight_kg > 0)) return 'weight_reps'
  if (work.some((s) => s.reps != null)) return 'bodyweight_reps'
  if (work.some((s) => s.distance_m != null)) return 'distance'
  if (work.some((s) => s.duration_s != null)) return 'duration'
  return 'weight_reps'
}

const kg = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 })

/**
 * Compact text for a session's sets. Consecutive sets with the same load are
 * merged: "60 kg × 8, 8, 7 · 62,5 kg × 6".
 */
export function setsLine(sets: readonly CompletedSet[], measurement: MeasurementType): string {
  if (measurement === 'duration') return sets.map((s) => formatDuration(s.duration_s, 'clock')).join(', ')
  if (measurement === 'distance') return sets.map((s) => formatDistance(s.distance_m)).join(', ')
  const groups: { weight: number | null; reps: string[] }[] = []
  for (const s of sets) {
    const w = s.weight_kg != null && s.weight_kg > 0 ? s.weight_kg : null
    const last = groups[groups.length - 1]
    const reps = s.reps == null ? '–' : String(s.reps)
    if (last && last.weight === w) last.reps.push(reps)
    else groups.push({ weight: w, reps: [reps] })
  }
  return groups.map((g) => {
    if (g.weight == null) return measurement === 'bodyweight_reps' ? `${g.reps.join(', ')} reps` : `– × ${g.reps.join(', ')}`
    const prefix = measurement === 'bodyweight_reps' ? '+' : ''
    return `${prefix}${kg.format(g.weight)} kg × ${g.reps.join(', ')}`
  }).join(' · ')
}

/** Longest duration or distance in a session (for timed / distance exercises). */
export function sessionBest(session: ExerciseSession, measurement: 'duration' | 'distance'): number | null {
  let best: number | null = null
  for (const s of session.sets) {
    const v = measurement === 'duration' ? s.duration_s : s.distance_m
    if (v != null && (best == null || v > best)) best = v
  }
  return best
}
