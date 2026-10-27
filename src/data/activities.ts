import { useMutation, useQuery } from '@tanstack/react-query'
import type { ActivityFact, DailySteps } from '@/domain/types'
import type { ActivityInput } from '@/domain/validation'
import type { Tables } from './database.types'
import { unwrap } from './errors'
import { keys, queryClient } from './queryClient'
import { supabase } from './supabase'

export type ActivityRow = Pick<Tables<'activities'>,
  'id' | 'type' | 'status' | 'title' | 'started_at' | 'local_date' | 'timezone' | 'duration_s' |
  'perceived_exertion' | 'notes' | 'source' | 'template_name'> & {
  metrics: Pick<Tables<'activity_metrics'>, 'distance_m' | 'steps' | 'avg_heart_rate' | 'max_heart_rate'> | null
}

const ACTIVITY_SELECT =
  'id, type, status, title, started_at, local_date, timezone, duration_s, perceived_exertion, notes, source, template_name, ' +
  'metrics:activity_metrics(distance_m, steps, avg_heart_rate, max_heart_rate)'

/**
 * All completed activities, newest first. A personal app holds at most a few
 * thousand rows, so statistics are computed client side by src/domain/stats.
 */
export function useActivities() {
  return useQuery({
    queryKey: keys.activities,
    queryFn: async () => {
      const all: ActivityRow[] = []
      const page = 1000
      for (let from = 0; ; from += page) {
        const rows = unwrap(await supabase.from('activities').select(ACTIVITY_SELECT)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .range(from, from + page - 1)) as unknown as ActivityRow[]
        all.push(...rows)
        if (rows.length < page) break
      }
      return all
    },
  })
}

export function toFact(a: ActivityRow): ActivityFact {
  return {
    id: a.id,
    type: a.type,
    local_date: a.local_date,
    duration_s: a.duration_s,
    distance_m: a.metrics?.distance_m ?? null,
    steps: a.metrics?.steps ?? null,
    source: a.source,
  }
}

function metricsOf(input: ActivityInput) {
  const m = {
    distance_m: input.distance_m, steps: input.steps,
    avg_heart_rate: input.avg_heart_rate, max_heart_rate: input.max_heart_rate,
  }
  return Object.values(m).some((v) => v != null) ? m : null
}

export function useSaveActivity() {
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ActivityInput }) => {
      const base = {
        type: input.type, started_at: input.started_at, timezone: input.timezone,
        duration_s: input.duration_s, perceived_exertion: input.perceived_exertion,
        title: input.title, notes: input.notes,
      }
      const row: { id: string } = id
        ? unwrap(await supabase.from('activities').update(base).eq('id', id).select('id').single())
        : unwrap(await supabase.from('activities').insert({ ...base, status: 'completed', source: 'manual' }).select('id').single())
      const metrics = metricsOf(input)
      if (metrics) {
        unwrap(await supabase.from('activity_metrics').upsert({ activity_id: row.id, ...metrics }, { onConflict: 'activity_id' }))
      } else if (id) {
        unwrap(await supabase.from('activity_metrics').delete().eq('activity_id', id))
      }
      return row.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.activities }),
  })
}

/** Correct when an activity started and how long it lasted (e.g. a gym session left running). */
export function useUpdateActivityTime() {
  return useMutation({
    mutationFn: async ({ id, startedAt, durationS }: { id: string; startedAt: string; durationS: number }) => {
      const endedAt = new Date(Date.parse(startedAt) + durationS * 1000).toISOString()
      unwrap(await supabase.from('activities')
        .update({ started_at: startedAt, ended_at: endedAt, duration_s: durationS })
        .eq('id', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.activities })
      queryClient.invalidateQueries({ queryKey: ['exercise-history'] })
    },
  })
}

export function useDeleteActivity() {
  return useMutation({
    mutationFn: async (id: string) => { unwrap(await supabase.from('activities').delete().eq('id', id)) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.activities })
      queryClient.invalidateQueries({ queryKey: ['exercise-history'] })
    },
  })
}

/** Daily step totals imported from a health source (none until integrations exist). */
export function useDailySteps() {
  return useQuery({
    queryKey: keys.dailySteps,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('daily_metrics').select('date, steps').not('steps', 'is', null))
      // Several sources may report the same day: keep the highest, never sum them.
      const byDay = new Map<string, number>()
      for (const r of rows) byDay.set(r.date, Math.max(byDay.get(r.date) ?? 0, r.steps ?? 0))
      return [...byDay].map(([date, steps]): DailySteps => ({ date, steps }))
    },
  })
}
