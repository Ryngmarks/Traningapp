import { useQuery } from '@tanstack/react-query'
import type { CompletedSet } from '@/domain/types'
import { unwrap } from './errors'
import { keys } from './queryClient'
import { supabase } from './supabase'

interface Row {
  kind: CompletedSet['kind']
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  performed_exercise: { exercise_id: string | null; activity: { id: string; local_date: string; status: string } }
}

/** Every completed set ever logged for an exercise, oldest first. */
export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: keys.exerciseHistory(exerciseId ?? ''),
    enabled: Boolean(exerciseId),
    queryFn: async (): Promise<CompletedSet[]> => {
      const rows = unwrap(await supabase.from('performed_sets')
        .select('kind, weight_kg, reps, duration_s, distance_m, performed_exercise:performed_exercises!inner(exercise_id, activity:activities!inner(id, local_date, status))')
        .eq('performed_exercise.exercise_id', exerciseId!)
        .eq('performed_exercise.activity.status', 'completed')
        .not('completed_at', 'is', null)) as unknown as Row[]
      return rows
        .map((r) => ({
          kind: r.kind, weight_kg: r.weight_kg, reps: r.reps, duration_s: r.duration_s, distance_m: r.distance_m,
          date: r.performed_exercise.activity.local_date,
          activityId: r.performed_exercise.activity.id,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },
  })
}

/** Exercise ids the user has completed at least once (for the strength picker). */
export function useTrainedExerciseIds() {
  return useQuery({
    queryKey: ['exercise-history', 'trained'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('performed_exercises')
        .select('exercise_id, activity:activities!inner(status)')
        .eq('activity.status', 'completed')
        .not('exercise_id', 'is', null))
      return [...new Set(rows.map((r) => r.exercise_id!))]
    },
  })
}
