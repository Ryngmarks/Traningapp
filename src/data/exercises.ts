import { useMutation, useQuery } from '@tanstack/react-query'
import type { ExerciseInput } from '@/domain/validation'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type Exercise = Tables<'exercises'>

/** Global library + the user's own (non-archived) exercises, sorted by name. */
export function useExercises() {
  return useQuery({
    queryKey: keys.exercises,
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(
      await supabase.from('exercises').select('*').is('archived_at', null).order('name'),
    ),
  })
}

/** Created by a member (not part of the global library). */
export const isCustomExercise = (e: Pick<Exercise, 'owner_id'>) => e.owner_id !== null
/** Created by the signed-in user: only these can be edited or archived. */
export const isOwnExercise = (e: Pick<Exercise, 'owner_id'>, userId: string | undefined) =>
  e.owner_id !== null && e.owner_id === userId

export function useSaveExercise() {
  return useMutation({
    mutationFn: async ({ id, input, ownerId }: { id?: string; input: ExerciseInput; ownerId: string }) => {
      if (id) {
        return unwrap(await supabase.from('exercises').update(input).eq('id', id).select('*').single())
      }
      return unwrap(await supabase.from('exercises').insert({ ...input, owner_id: ownerId }).select('*').single())
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.exercises }),
  })
}

/** Custom exercises are archived, not deleted, so templates and history keep working. */
export function useArchiveExercise() {
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('exercises').update({ archived_at: new Date().toISOString() }).eq('id', id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.exercises }),
  })
}
