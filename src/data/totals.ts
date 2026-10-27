import { useMutation, useQuery } from '@tanstack/react-query'
import type { HistoricalTotalInput } from '@/domain/validation'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type HistoricalTotalRow = Tables<'historical_totals'>

export function useHistoricalTotals() {
  return useQuery({
    queryKey: keys.totals,
    queryFn: async () => unwrap(await supabase.from('historical_totals').select('*').order('covers_until', { ascending: false })),
  })
}

export function useSaveHistoricalTotal() {
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: HistoricalTotalInput }) => id
      ? unwrap(await supabase.from('historical_totals').update(input).eq('id', id).select('*').single())
      : unwrap(await supabase.from('historical_totals').insert(input).select('*').single()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.totals }),
  })
}

export function useDeleteHistoricalTotal() {
  return useMutation({
    mutationFn: async (id: string) => { unwrap(await supabase.from('historical_totals').delete().eq('id', id)) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.totals }),
  })
}
