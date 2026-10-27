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

export function useDeleteTemplate() {
  return useMutation({
    // Past workouts keep their snapshot; their template_id is set to null.
    mutationFn: async (id: string) => { unwrap(await supabase.from('workout_templates').delete().eq('id', id)) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  })
}
