import { useMutation, useQuery } from '@tanstack/react-query'
import type { ImportRow } from '@/domain/importParse'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type ImportLog = Tables<'imports'>

export function useImports() {
  return useQuery({
    queryKey: keys.imports,
    queryFn: async () => unwrap(await supabase.from('imports').select('*').order('created_at', { ascending: false }).limit(20)),
  })
}

/** Server-side validated, idempotent import (re-importing a file adds nothing). */
export function useRunImport() {
  return useMutation({
    mutationFn: async ({ kind, fileName, rows }: { kind: 'csv' | 'json'; fileName: string; rows: ImportRow[] }) =>
      unwrap(await supabase.rpc('import_activities', {
        p_source: kind === 'csv' ? 'import_csv' : 'import_json',
        p_file_name: fileName,
        p_rows: rows,
      })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.imports })
      queryClient.invalidateQueries({ queryKey: keys.activities })
    },
  })
}
