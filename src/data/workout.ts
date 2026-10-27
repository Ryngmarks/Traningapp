import { useQuery } from '@tanstack/react-query'
import type { LastPerformance } from '@/domain/progression'
import type { SetValues } from '@/domain/types'
import type { Tables } from './database.types'
import { toDataError, unwrap, unwrapMaybe } from './errors'
import { deviceTimezone } from './profile'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type PerformedSet = Tables<'performed_sets'>
export type PerformedExercise = Tables<'performed_exercises'> & { sets: PerformedSet[] }
export type ActiveWorkout = Tables<'activities'> & { exercises: PerformedExercise[] }

const WORKOUT_SELECT = '*, exercises:performed_exercises(*, sets:performed_sets(*))'

function normalize(w: ActiveWorkout): ActiveWorkout {
  return {
    ...w,
    exercises: [...w.exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ ...e, sets: [...e.sets].sort((a, b) => a.position - b.position) })),
  }
}

export async function fetchActiveWorkout(): Promise<ActiveWorkout | null> {
  const row = unwrapMaybe(await supabase.from('activities').select(WORKOUT_SELECT)
    .eq('type', 'gym').eq('status', 'in_progress').maybeSingle())
  return row ? normalize(row as unknown as ActiveWorkout) : null
}

/** The running gym session, if any. Survives reloads because it lives in the DB. */
export function useActiveWorkout() {
  return useQuery({ queryKey: keys.activeWorkout, queryFn: fetchActiveWorkout, refetchOnWindowFocus: false })
}

export async function fetchWorkout(id: string): Promise<ActiveWorkout> {
  const row = unwrap(await supabase.from('activities').select(WORKOUT_SELECT).eq('id', id).single())
  return normalize(row as unknown as ActiveWorkout)
}

export async function startWorkout(templateId: string | null): Promise<string> {
  const id = unwrap(await supabase.rpc('start_workout', {
    ...(templateId ? { p_template_id: templateId } : {}),
    p_timezone: deviceTimezone(),
  }))
  await queryClient.invalidateQueries({ queryKey: keys.activeWorkout })
  return id
}

export async function finishWorkout(activityId: string): Promise<void> {
  unwrap(await supabase.rpc('finish_workout', { p_activity_id: activityId }))
  queryClient.setQueryData(keys.activeWorkout, null)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.activities }),
    queryClient.invalidateQueries({ queryKey: ['workout', 'last'] }),
    queryClient.invalidateQueries({ queryKey: ['exercise-history'] }),
  ])
}

/** Deletes the running workout and everything in it. */
export async function discardWorkout(activityId: string): Promise<void> {
  unwrap(await supabase.from('activities').delete().eq('id', activityId).eq('status', 'in_progress'))
  queryClient.setQueryData(keys.activeWorkout, null)
}

export async function addExerciseToWorkout(
  activityId: string,
  exerciseId: string,
  position: number,
  plan: { warmup_sets?: number; planned_sets?: number; rep_min?: number | null; rep_max?: number | null } = {},
): Promise<string> {
  return unwrap(await supabase.rpc('add_performed_exercise', {
    p_activity_id: activityId,
    p_exercise_id: exerciseId,
    p_position: position,
    p_warmup_sets: plan.warmup_sets ?? 0,
    p_planned_sets: plan.planned_sets ?? 3,
    ...(plan.rep_min != null ? { p_rep_min: plan.rep_min } : {}),
    ...(plan.rep_max != null ? { p_rep_max: plan.rep_max } : {}),
  }))
}

export async function removeExerciseFromWorkout(performedExerciseId: string): Promise<void> {
  unwrap(await supabase.from('performed_exercises').delete().eq('id', performedExerciseId))
}

export async function updatePerformedExercise(id: string, patch: { position?: number; notes?: string | null }): Promise<void> {
  unwrap(await supabase.from('performed_exercises').update(patch).eq('id', id))
}

/** Row the client sends for a set. The id is generated client side. */
export type SetRow = Pick<PerformedSet,
  'id' | 'performed_exercise_id' | 'position' | 'kind' | 'weight_kg' | 'reps' | 'duration_s' | 'distance_m' | 'completed_at'>

/** Idempotent: retrying the same row can never create a duplicate set. */
export async function upsertSet(row: SetRow): Promise<void> {
  const { error } = await supabase.from('performed_sets').upsert(row, { onConflict: 'id' })
  if (error) throw toDataError(error)
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from('performed_sets').delete().eq('id', id)
  if (error) throw toDataError(error)
}

export type LastPerformanceRow = LastPerformance & { exercise_id: string; started_at: string }

/** Last completed sets for each exercise, keyed by exercise id. */
export function useLastPerformances(exerciseIds: readonly string[]) {
  return useQuery({
    queryKey: keys.lastPerformances(exerciseIds),
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc('last_performances', { p_exercise_ids: [...exerciseIds] }))
      const map = new Map<string, LastPerformanceRow>()
      for (const r of rows) {
        map.set(r.exercise_id, {
          exercise_id: r.exercise_id,
          started_at: r.started_at,
          rep_min: r.rep_min,
          rep_max: r.rep_max,
          sets: (r.sets as unknown as SetValues[] | null) ?? [],
        })
      }
      return map
    },
  })
}
