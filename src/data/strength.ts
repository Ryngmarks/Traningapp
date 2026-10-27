import { useQuery } from '@tanstack/react-query'
import type { CompletedSet } from '@/domain/types'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys } from './queryClient'
import { supabase } from './supabase'

interface Row {
  position: number
  kind: CompletedSet['kind']
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  speed_kmh: number | null
  incline_pct: number | null
  calories: number | null
  performed_exercise: { exercise_id: string | null; activity: { id: string; local_date: string; status: string } }
}

const HISTORY_SELECT =
  'position, kind, weight_kg, reps, duration_s, distance_m, speed_kmh, incline_pct, calories, ' +
  'performed_exercise:performed_exercises!inner(exercise_id, activity:activities!inner(id, local_date, status))'

/** Completed sets of the given exercises, oldest first, grouped by exercise id. */
async function fetchHistories(exerciseIds: readonly string[]): Promise<Map<string, CompletedSet[]>> {
  const rows = unwrap(await supabase.from('performed_sets')
    .select(HISTORY_SELECT)
    .in('performed_exercise.exercise_id', [...exerciseIds])
    .eq('performed_exercise.activity.status', 'completed')
    .not('completed_at', 'is', null)
    .order('position')) as unknown as Row[]
  const byExercise = new Map<string, CompletedSet[]>(exerciseIds.map((id) => [id, []]))
  for (const r of rows) {
    byExercise.get(r.performed_exercise.exercise_id!)?.push({
      kind: r.kind, weight_kg: r.weight_kg, reps: r.reps, duration_s: r.duration_s, distance_m: r.distance_m,
      speed_kmh: r.speed_kmh, incline_pct: r.incline_pct, calories: r.calories,
      date: r.performed_exercise.activity.local_date,
      activityId: r.performed_exercise.activity.id,
    })
  }
  // Stable sort keeps set order (by position) within each session.
  for (const list of byExercise.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return byExercise
}

/** Every completed set ever logged for an exercise, oldest first. */
export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: keys.exerciseHistory(exerciseId ?? ''),
    enabled: Boolean(exerciseId),
    queryFn: async () => (await fetchHistories([exerciseId!])).get(exerciseId!) ?? [],
  })
}

/** History for several exercises in one request (the active workout's PB/Senast/Oftast box). */
export function useExerciseHistories(exerciseIds: readonly string[]) {
  return useQuery({
    queryKey: ['exercise-history', 'many', [...exerciseIds].sort().join(',')],
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => fetchHistories(exerciseIds),
  })
}

export interface TrainedExercise {
  id: string
  name: string
  category: Tables<'exercises'>['category']
  measurement_type: Tables<'exercises'>['measurement_type']
}

/**
 * Exercises the user has completed at least once, with the snapshot saved in
 * history, so archived exercises still show up with their name.
 */
export function useTrainedExercises() {
  return useQuery({
    queryKey: ['exercise-history', 'trained'],
    queryFn: async (): Promise<TrainedExercise[]> => {
      const rows = unwrap(await supabase.from('performed_exercises')
        .select('exercise_id, exercise_name, category, measurement_type, created_at, activity:activities!inner(status)')
        .eq('activity.status', 'completed')
        .not('exercise_id', 'is', null)
        .order('created_at', { ascending: false }))
      const byId = new Map<string, TrainedExercise>()
      for (const r of rows) {
        // Newest first: keep the most recent snapshot of each exercise.
        if (!byId.has(r.exercise_id!)) {
          byId.set(r.exercise_id!, { id: r.exercise_id!, name: r.exercise_name, category: r.category, measurement_type: r.measurement_type })
        }
      }
      return [...byId.values()]
    },
  })
}
