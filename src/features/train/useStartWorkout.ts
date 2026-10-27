import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toDataError } from '@/data/errors'
import { keys, queryClient } from '@/data/queryClient'
import { startWorkout } from '@/data/workout'
import { useToast } from '@/ui/Toast'

/**
 * Starts a workout (from a template, or free with `null`) and opens it.
 * If one is already running, goes to that one instead.
 */
export function useStartWorkout() {
  const navigate = useNavigate()
  const toast = useToast()
  const m = useMutation({
    mutationFn: (templateId: string | null) => startWorkout(templateId),
    onSuccess: () => navigate('/traning/pass'),
    onError: async (e) => {
      const err = toDataError(e)
      if (err.code === 'active_workout_exists') {
        await queryClient.invalidateQueries({ queryKey: keys.activeWorkout })
        toast(err.message, { tone: 'info' })
        navigate('/traning/pass')
        return
      }
      toast(err.message, { tone: 'error' })
    },
  })
  return {
    start: (templateId: string | null) => { if (!m.isPending) m.mutate(templateId) },
    isPending: m.isPending,
    /** True while this particular start (template id, or null for a free workout) is running. */
    isStarting: (templateId: string | null) => m.isPending && m.variables === templateId,
  }
}
