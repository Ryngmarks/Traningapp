import { useQuery } from '@tanstack/react-query'
import { unwrap } from './errors'
import { supabase } from './supabase'

/**
 * Display names of all members, to show who shared a template or exercise.
 * The members table exposes nothing else from other members' profiles.
 */
export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('members').select('user_id, display_name'))
      return new Map(rows.map((r) => [r.user_id, r.display_name?.trim() || 'Medlem']))
    },
  })
}
