import { useMutation, useQuery } from '@tanstack/react-query'
import type { Tables, TablesUpdate } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type Profile = Tables<'profiles'>

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').single()),
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (patch: Pick<TablesUpdate<'profiles'>, 'display_name' | 'timezone' | 'weight_increment_kg'> & { id: string }) => {
      const { id, ...rest } = patch
      return unwrap(await supabase.from('profiles').update(rest).eq('id', id).select('*').single())
    },
    onSuccess: (p) => queryClient.setQueryData(keys.profile, p),
  })
}

/** The device timezone, used when logging new activities. */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm'
}
