import { QueryClient } from '@tanstack/react-query'
import { DataError } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => count < 2 && (!(error instanceof DataError) || error.retryable),
    },
    mutations: { retry: false },
  },
})

export const keys = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  exercises: ['exercises'] as const,
  templates: ['templates'] as const,
  template: (id: string) => ['templates', id] as const,
  activeWorkout: ['workout', 'active'] as const,
  lastPerformances: (ids: readonly string[]) => ['workout', 'last', [...ids].sort().join(',')] as const,
  activities: ['activities'] as const,
  activity: (id: string) => ['activities', id] as const,
  totals: ['historical-totals'] as const,
  imports: ['imports'] as const,
  exerciseHistory: (id: string) => ['exercise-history', id] as const,
  dailySteps: ['daily-steps'] as const,
}
