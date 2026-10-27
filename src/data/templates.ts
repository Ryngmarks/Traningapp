import { useMutation, useQuery } from '@tanstack/react-query'
import type { TemplateInput } from '@/domain/validation'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type TemplateItem = Tables<'template_exercises'> & {
  exercise: Pick<Tables<'exercises'>, 'id' | 'name' | 'category' | 'measurement_type'> | null
}
export type Template = Tables<'workout_templates'> & { items: TemplateItem[] }

const TEMPLATE_SELECT = '*, items:template_exercises(*, exercise:exercises(id, name, category, measurement_type))'

function sortItems(t: Template): Template {
  return { ...t, items: [...t.items].sort((a, b) => a.position - b.position) }
}

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('workout_templates').select(TEMPLATE_SELECT)
        .is('archived_at', null).order('sort_order').order('created_at'))
      return (rows as unknown as Template[]).map(sortItems)
    },
  })
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: keys.template(id ?? 'new'),
    enabled: Boolean(id),
    queryFn: async () => {
      const row = unwrap(await supabase.from('workout_templates').select(TEMPLATE_SELECT).eq('id', id!).single())
      return sortItems(row as unknown as Template)
    },
  })
}

/** Creates or updates a template and its exercise list atomically (RPC). */
export function useSaveTemplate() {
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TemplateInput }) =>
      unwrap(await supabase.rpc('save_template', {
        p_template_id: id ?? (null as unknown as string),
        p_name: input.name,
        p_notes: input.notes ?? '',
        p_items: input.items,
      })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  })
}

/** Templates are shared with all members; only the creator can edit. */
export const isOwnTemplate = (t: Pick<Template, 'user_id'>, userId: string | undefined) =>
  t.user_id !== null && t.user_id === userId

/** Copy a shared or global template into the user's own templates. Returns the new id. */
export function useCopyTemplate() {
  return useMutation({
    mutationFn: async (t: Template) =>
      unwrap(await supabase.rpc('save_template', {
        p_template_id: null as unknown as string,
        p_name: t.name,
        p_notes: t.notes ?? '',
        p_items: t.items.map((i) => ({
          exercise_id: i.exercise_id, warmup_sets: i.warmup_sets, planned_sets: i.planned_sets,
          rep_min: i.rep_min, rep_max: i.rep_max, target_duration_s: i.target_duration_s,
          target_distance_m: i.target_distance_m, rest_seconds: i.rest_seconds, notes: i.notes,
        })),
      })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  })
}

export function useDeleteTemplate() {
  return useMutation({
    // Past workouts keep their snapshot; their template_id is set to null.
    mutationFn: async (id: string) => { unwrap(await supabase.from('workout_templates').delete().eq('id', id)) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  })
}
