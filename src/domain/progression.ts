import type { CompletedSet, MeasurementType, SetValues } from './types'

/**
 * Double progression (docs/TRAINING_MODEL.md).
 *
 * Work inside a rep range (e.g. 3 × 8–12). When every working set of the last
 * session reached the top of the range at the same load, suggest a small load
 * increase and start again at the bottom of the range. Suggestions are only
 * ever offered; the user decides.
 */
export type ProgressionSuggestion =
  | { kind: 'increase_weight'; fromKg: number; toKg: number; reps: number }
  | { kind: 'add_reps'; targetReps: number }
  | { kind: 'hold' }

export interface LastPerformance {
  rep_min: number | null
  rep_max: number | null
  sets: SetValues[]
}

export function workingSets<T extends SetValues>(sets: readonly T[]): T[] {
  return sets.filter((s) => s.kind === 'working')
}

/** Smallest plate-friendly step for a given load. */
export function defaultIncrement(weightKg: number, preferredKg: number): number {
  if (weightKg < 20) return Math.min(preferredKg, 1)
  return preferredKg
}

export function roundToStep(value: number, step = 0.25): number {
  return Math.round(value / step) * step
}

export function suggestProgression(
  last: LastPerformance | null | undefined,
  measurement: MeasurementType,
  incrementKg = 2.5,
): ProgressionSuggestion | null {
  if (!last || last.rep_min == null || last.rep_max == null) return null
  if (measurement !== 'weight_reps' && measurement !== 'bodyweight_reps') return null

  const work = workingSets(last.sets).filter((s) => s.reps != null)
  if (work.length === 0) return null

  const reps = work.map((s) => s.reps!)
  const allAtTop = reps.every((r) => r >= last.rep_max!)
  const anyBelowBottom = reps.some((r) => r < last.rep_min!)

  const loads = work.map((s) => s.weight_kg ?? 0)
  const minLoad = Math.min(...loads)
  const sameLoad = loads.every((l) => l === minLoad)

  if (allAtTop && sameLoad && measurement === 'weight_reps' && minLoad > 0) {
    const toKg = roundToStep(minLoad + defaultIncrement(minLoad, incrementKg))
    return { kind: 'increase_weight', fromKg: minLoad, toKg, reps: last.rep_min }
  }
  if (anyBelowBottom) return { kind: 'hold' }
  if (allAtTop) {
    // Bodyweight, or mixed loads: keep it simple and suggest the top again.
    return { kind: 'add_reps', targetReps: last.rep_max }
  }
  return { kind: 'add_reps', targetReps: Math.min(last.rep_max, Math.min(...reps) + 1) }
}

// ---------------------------------------------------------------------------
// Volume, estimated 1RM and personal bests
// ---------------------------------------------------------------------------

/** Load volume (kg × reps) of completed working sets. */
export function setVolume(s: SetValues): number {
  if (s.kind !== 'working' || s.weight_kg == null || s.reps == null) return 0
  return s.weight_kg * s.reps
}

export function totalVolume(sets: readonly SetValues[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

/** Epley estimate. Only meaningful for 1–12 reps; returns null otherwise. */
export function estimatedOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps < 1 || reps > 12) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export interface PersonalBests {
  heaviest: { weightKg: number; reps: number; date: string } | null
  bestEstimated1RM: { value: number; weightKg: number; reps: number; date: string } | null
  mostReps: { reps: number; weightKg: number | null; date: string } | null
  bestSessionVolume: { volume: number; date: string } | null
  longestDuration: { seconds: number; date: string } | null
  longestDistance: { meters: number; date: string } | null
}

export function personalBests(history: readonly CompletedSet[]): PersonalBests {
  const pb: PersonalBests = {
    heaviest: null, bestEstimated1RM: null, mostReps: null,
    bestSessionVolume: null, longestDuration: null, longestDistance: null,
  }
  const volumeBySession = new Map<string, { volume: number; date: string }>()

  for (const s of history) {
    if (s.kind !== 'working') continue
    if (s.weight_kg != null && s.reps != null && s.reps > 0) {
      if (!pb.heaviest || s.weight_kg > pb.heaviest.weightKg ||
          (s.weight_kg === pb.heaviest.weightKg && s.reps > pb.heaviest.reps)) {
        pb.heaviest = { weightKg: s.weight_kg, reps: s.reps, date: s.date }
      }
      const e1rm = estimatedOneRepMax(s.weight_kg, s.reps)
      if (e1rm != null && (!pb.bestEstimated1RM || e1rm > pb.bestEstimated1RM.value)) {
        pb.bestEstimated1RM = { value: e1rm, weightKg: s.weight_kg, reps: s.reps, date: s.date }
      }
    }
    if (s.reps != null && (!pb.mostReps || s.reps > pb.mostReps.reps)) {
      pb.mostReps = { reps: s.reps, weightKg: s.weight_kg, date: s.date }
    }
    if (s.duration_s != null && (!pb.longestDuration || s.duration_s > pb.longestDuration.seconds)) {
      pb.longestDuration = { seconds: s.duration_s, date: s.date }
    }
    if (s.distance_m != null && (!pb.longestDistance || s.distance_m > pb.longestDistance.meters)) {
      pb.longestDistance = { meters: s.distance_m, date: s.date }
    }
    const v = setVolume(s)
    if (v > 0) {
      const cur = volumeBySession.get(s.activityId) ?? { volume: 0, date: s.date }
      cur.volume += v
      volumeBySession.set(s.activityId, cur)
    }
  }
  for (const session of volumeBySession.values()) {
    if (!pb.bestSessionVolume || session.volume > pb.bestSessionVolume.volume) pb.bestSessionVolume = session
  }
  return pb
}

export interface SessionSummary {
  activityId: string
  date: string
  volume: number
  topWeightKg: number | null
  bestE1RM: number | null
  totalReps: number
}

/** One point per workout, oldest first, for strength-over-time charts. */
export function sessionSummaries(history: readonly CompletedSet[]): SessionSummary[] {
  const map = new Map<string, SessionSummary>()
  for (const s of history) {
    if (s.kind !== 'working') continue
    const cur = map.get(s.activityId) ??
      { activityId: s.activityId, date: s.date, volume: 0, topWeightKg: null, bestE1RM: null, totalReps: 0 }
    cur.volume += setVolume(s)
    cur.totalReps += s.reps ?? 0
    if (s.weight_kg != null && (cur.topWeightKg == null || s.weight_kg > cur.topWeightKg)) cur.topWeightKg = s.weight_kg
    const e = estimatedOneRepMax(s.weight_kg, s.reps)
    if (e != null && (cur.bestE1RM == null || e > cur.bestE1RM)) cur.bestE1RM = e
    map.set(s.activityId, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}
