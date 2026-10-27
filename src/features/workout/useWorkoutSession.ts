import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSetReady, nextSetValues, workoutProgress } from '@/domain/workout'
import type { SetKind } from '@/domain/types'
import { toDataError } from '@/data/errors'
import { keys, queryClient } from '@/data/queryClient'
import {
  type ActiveWorkout, addExerciseToWorkout, deleteSet, discardWorkout, fetchWorkout, finishWorkout,
  type PerformedExercise, type PerformedSet, removeExerciseFromWorkout, type SetRow, upsertSet,
} from '@/data/workout'
import { SyncQueue, type SyncStatus } from './syncQueue'

export type SetPatch = Partial<Pick<PerformedSet,
  'weight_kg' | 'reps' | 'duration_s' | 'distance_m' | 'speed_kmh' | 'incline_pct' | 'calories' | 'kind'>>

const UNSAVED: readonly SyncStatus[] = ['pending', 'saving', 'error']

function toRow(s: PerformedSet): SetRow {
  return {
    id: s.id, performed_exercise_id: s.performed_exercise_id, position: s.position, kind: s.kind,
    weight_kg: s.weight_kg, reps: s.reps, duration_s: s.duration_s, distance_m: s.distance_m,
    speed_kmh: s.speed_kmh, incline_pct: s.incline_pct, calories: s.calories, completed_at: s.completed_at,
  }
}

/**
 * State and actions for the running gym session. The UI renders `exercises`
 * and calls the actions; every set change is persisted through the SyncQueue
 * and its status is exposed per set so the UI never claims unsaved data is safe.
 */
export function useWorkoutSession(initial: ActiveWorkout) {
  const [workout, setWorkoutState] = useState(initial)
  const [statuses, setStatuses] = useState<Record<string, SyncStatus>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Source of truth between renders, so rapid taps always build on the latest state.
  const workoutRef = useRef(initial)
  const statusesRef = useRef(statuses)
  useEffect(() => { statusesRef.current = statuses }, [statuses])

  const commit = useCallback((next: ActiveWorkout) => {
    workoutRef.current = next
    setWorkoutState(next)
    // Keep the cached workout current so re-entry and the shell pill never show stale sets.
    queryClient.setQueryData(keys.activeWorkout, next)
  }, [])

  const mapExercises = useCallback((fn: (e: PerformedExercise) => PerformedExercise) => {
    const w = workoutRef.current
    commit({ ...w, exercises: w.exercises.map(fn) })
  }, [commit])

  const findSet = (exerciseId: string, setId: string) => {
    const ex = workoutRef.current.exercises.find((e) => e.id === exerciseId)
    return { ex, set: ex?.sets.find((s) => s.id === setId) }
  }

  const queue = useMemo(() => new SyncQueue<SetRow>({
    save: (op) => (op.kind === 'upsert' ? upsertSet(op.row) : deleteSet(op.id)),
    onStatus: (id, status, err) => {
      setStatuses((prev) => {
        if (status === 'saved') {
          const { [id]: _done, ...rest } = prev
          return rest
        }
        return { ...prev, [id]: status }
      })
      if (status === 'error') setError(toDataError(err).message)
    },
  }), [])

  // Leaving the screen must not drop debounced edits: send them now. The
  // requests complete even after unmount.
  useEffect(() => () => { void queue.flushAll() }, [queue])

  // Retry automatically when the connection returns; warn before closing with unsaved work.
  useEffect(() => {
    const onOnline = () => { void queue.retryFailed() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.hasUnsaved()) { e.preventDefault(); e.returnValue = '' }
    }
    const onHide = () => { if (document.visibilityState === 'hidden') void queue.flushAll() }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [queue])

  const replaceSet = useCallback((exerciseId: string, next: PerformedSet) => {
    mapExercises((e) => e.id !== exerciseId ? e : { ...e, sets: e.sets.map((s) => (s.id === next.id ? next : s)) })
  }, [mapExercises])

  /** Edit values of a set (debounced save). */
  const updateSet = useCallback((exerciseId: string, setId: string, patch: SetPatch) => {
    const { set } = findSet(exerciseId, setId)
    if (!set) return
    const next = { ...set, ...patch }
    replaceSet(exerciseId, next)
    queue.upsert(next.id, toRow(next))
  }, [replaceSet, queue])

  /** Mark a set done (or undo). Saved immediately. Returns false if values are missing. */
  const toggleComplete = useCallback((exerciseId: string, setId: string): boolean => {
    const { ex, set } = findSet(exerciseId, setId)
    if (!ex || !set) return false
    if (!set.completed_at && !isSetReady(set, ex.measurement_type)) return false
    const next = { ...set, completed_at: set.completed_at ? null : new Date().toISOString() }
    replaceSet(exerciseId, next)
    queue.upsert(next.id, toRow(next), true)
    return true
  }, [replaceSet, queue])

  const addSet = useCallback((exerciseId: string, kind: SetKind = 'working') => {
    const ex = workoutRef.current.exercises.find((e) => e.id === exerciseId)
    if (!ex) return
    const now = new Date().toISOString()
    const set: PerformedSet = {
      id: crypto.randomUUID(), performed_exercise_id: exerciseId, user_id: workoutRef.current.user_id,
      ...nextSetValues(ex.sets, kind), completed_at: null, created_at: now, updated_at: now,
    }
    // Warm-ups go before working sets; keep positions dense and ordered.
    const ordered = kind === 'warmup'
      ? [...ex.sets.filter((s) => s.kind === 'warmup'), set, ...ex.sets.filter((s) => s.kind !== 'warmup')]
      : [...ex.sets, set]
    const sets = ordered.map((s, i) => (s.position === i ? s : { ...s, position: i }))
    mapExercises((e) => (e.id === exerciseId ? { ...e, sets } : e))
    for (const s of sets) {
      const before = ex.sets.find((x) => x.id === s.id)
      if (!before || before.position !== s.position) queue.upsert(s.id, toRow(s), true)
    }
  }, [mapExercises, queue])

  /** Put back a set removed with removeSet (undo). Same id, so saving is idempotent. */
  const restoreSet = useCallback((exerciseId: string, set: PerformedSet) => {
    mapExercises((e) => e.id !== exerciseId || e.sets.some((s) => s.id === set.id) ? e
      : { ...e, sets: [...e.sets, set].sort((a, b) => a.position - b.position) })
    queue.upsert(set.id, toRow(set), true)
  }, [mapExercises, queue])

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    mapExercises((e) => e.id !== exerciseId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) })
    queue.delete(setId)
  }, [mapExercises, queue])

  /** Reload from the server, keeping local edits that are not confirmed yet. */
  const reload = useCallback(async () => {
    const server = await fetchWorkout(workout.id)
    const local = new Map(workoutRef.current.exercises.flatMap((e) => e.sets.map((s) => [s.id, s] as const)))
    const unsavedIds = Object.entries(statusesRef.current).filter(([, st]) => UNSAVED.includes(st)).map(([id]) => id)
    const exercises: PerformedExercise[] = server.exercises.map((e) => {
      const sets = e.sets.map((s) => (unsavedIds.includes(s.id) ? local.get(s.id) ?? s : s))
      for (const id of unsavedIds) {
        const l = local.get(id)
        if (l && l.performed_exercise_id === e.id && !sets.some((s) => s.id === id)) sets.push(l)
      }
      return { ...e, sets: sets.sort((a, b) => a.position - b.position) }
    })
    commit({ ...server, exercises })
    queryClient.setQueryData(keys.activeWorkout, { ...server, exercises })
  }, [workout.id, commit])

  const runStructural = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await queue.flushAll()
      await fn()
      await reload()
    } catch (e) {
      setError(toDataError(e).message)
    } finally {
      setBusy(false)
    }
  }, [queue, reload])

  const nextPosition = () => Math.max(-1, ...workoutRef.current.exercises.map((e) => e.position)) + 1

  const addExercise = useCallback((exerciseId: string, plan?: { planned_sets?: number }) => runStructural(async () => {
    await addExerciseToWorkout(workout.id, exerciseId, nextPosition(), plan)
  }), [runStructural, workout.id])

  const removeExercise = useCallback((performedExerciseId: string) => runStructural(async () => {
    await removeExerciseFromWorkout(performedExerciseId)
  }), [runStructural])

  /** Replace an exercise in place, keeping the plan (sets and rep range). */
  const swapExercise = useCallback((performedExerciseId: string, exerciseId: string) => runStructural(async () => {
    const old = workoutRef.current.exercises.find((e) => e.id === performedExerciseId)
    if (!old) return
    await addExerciseToWorkout(workout.id, exerciseId, old.position, {
      warmup_sets: old.sets.filter((s) => s.kind === 'warmup').length,
      planned_sets: Math.max(1, old.sets.filter((s) => s.kind === 'working').length),
      rep_min: old.rep_min, rep_max: old.rep_max,
    })
    await removeExerciseFromWorkout(performedExerciseId)
  }), [runStructural, workout.id])

  /** Finish even if not all planned sets are done. Refuses while anything is unsaved. */
  const finish = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await queue.flushAll()
      if (queue.hasUnsaved()) {
        setError('Några set är inte sparade än. Kontrollera anslutningen och försök igen.')
        return false
      }
      await finishWorkout(workout.id)
      return true
    } catch (e) {
      setError(toDataError(e).message)
      return false
    } finally {
      setBusy(false)
    }
  }, [queue, workout.id])

  const discard = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    try {
      await discardWorkout(workout.id)
      // Only after the delete succeeded: if it fails, edits must keep saving.
      queue.dispose()
      return true
    } catch (e) {
      setError(toDataError(e).message)
      return false
    } finally {
      setBusy(false)
    }
  }, [queue, workout.id])

  const statusValues = Object.values(statuses)
  return {
    workout,
    exercises: workout.exercises,
    progress: workoutProgress(workout.exercises),
    statuses,
    /** Sets not yet confirmed by the server. */
    unsavedCount: statusValues.filter((s) => UNSAVED.includes(s)).length,
    failedCount: statusValues.filter((s) => s === 'error').length,
    busy,
    error,
    clearError: () => setError(null),
    retry: () => queue.retryFailed(),
    /** Send every pending edit now (e.g. before navigating away). */
    flush: () => queue.flushAll(),
    updateSet, toggleComplete, addSet, removeSet, restoreSet,
    addExercise, removeExercise, swapExercise,
    finish, discard,
  }
}

export type WorkoutSession = ReturnType<typeof useWorkoutSession>
