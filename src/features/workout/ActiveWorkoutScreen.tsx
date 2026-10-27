import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { exerciseSnapshot } from '@/domain/progression'
import { currentExerciseId } from '@/domain/workout'
import { type Profile, useProfile } from '@/data/profile'
import { useExerciseHistories } from '@/data/strength'
import { type ActiveWorkout, useActiveWorkout, useLastPerformances } from '@/data/workout'
import { useStartWorkout } from '@/features/train/useStartWorkout'
import { ExercisePicker } from '@/features/train/components/ExercisePicker'
import { Button } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { Screen, SubHeader } from '@/ui/Page'
import { Banner, EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { todayLocal } from '@/ui/useNow'
import { ExerciseCard } from './components/ExerciseCard'
import { ExerciseMenuSheet } from './components/ExerciseMenuSheet'
import { FinishSheet } from './components/FinishSheet'
import { useArmed } from './components/useArmed'
import { useOnline } from './components/useOnline'
import { type SyncState, WorkoutHeader } from './components/WorkoutHeader'
import { useWorkoutSession } from './useWorkoutSession'

const DEFAULT_WEIGHT_STEP = 2.5

/** Route `/traning/pass`: the running gym session. */
export function ActiveWorkoutScreen() {
  // Lift toasts above the fixed "Avsluta pass" bar while this screen is open.
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-offset', '104px')
    return () => { document.documentElement.style.removeProperty('--toast-offset') }
  }, [])
  const { data, error, refetch } = useActiveWorkout()
  // While finishing/discarding the cache is cleared before we navigate away;
  // keep the session mounted on its last state instead of flashing "no workout".
  const [ending, setEnding] = useState<ActiveWorkout | null>(null)
  // The session owns its state once mounted and set edits never touch the
  // query cache, so always load a fresh server copy on entry. If that fails
  // we fall back to the cached copy (or the error state).
  const [synced, setSynced] = useState(false)
  useEffect(() => {
    let alive = true
    void refetch().finally(() => { if (alive) setSynced(true) })
    return () => { alive = false }
  }, [refetch])

  const workout = ending ?? (synced ? data : null)
  if (workout) return <WorkoutSessionView key={workout.id} initial={workout} onEnding={setEnding} />
  if (!synced) return <WorkoutSkeleton />
  if (error) {
    return (
      <Screen>
        <SubHeader title="Pass" back="/traning" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    )
  }
  return <NoWorkout />
}

function NoWorkout() {
  const navigate = useNavigate()
  const { start, isStarting } = useStartWorkout()
  return (
    <Screen>
      <SubHeader title="Pass" back="/traning" />
      <EmptyState
        icon="dumbbell"
        title="Inget pågående pass"
        text="Välj en mall eller kör ett fritt pass och lägg till övningar medan du tränar."
        action={
          <div className="flex w-64 flex-col gap-2.5">
            <Button variant="primary" size="lg" block icon="play" loading={isStarting(null)} onClick={() => start(null)}>
              Starta fritt pass
            </Button>
            <Button size="lg" block onClick={() => navigate('/traning')}>Välj mall</Button>
          </div>
        }
      />
    </Screen>
  )
}

function WorkoutSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Laddar pass">
      <div className="border-b border-line/50 pt-safe">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="size-9" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2.5 rounded-[var(--radius-card)] border border-line/70 bg-surface p-3.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-28" />
            {[0, 1, 2].map((j) => <Skeleton key={j} className="h-12 w-full rounded-2xl" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

type PickerState = { mode: 'add' } | { mode: 'swap'; performedExerciseId: string } | null

function WorkoutSessionView({ initial, onEnding }: { initial: ActiveWorkout; onEnding: (w: ActiveWorkout | null) => void }) {
  const session = useWorkoutSession(initial)
  const { exercises, workout } = session
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  // Cast: useProfile().data is inferred as `null` by unwrap() on .single() (data-layer typing issue).
  const profile = useProfile().data as Profile | null | undefined
  const weightStep = profile && profile.weight_increment_kg > 0 ? profile.weight_increment_kg : DEFAULT_WEIGHT_STEP

  const exerciseIds = useMemo(
    () => [...new Set(exercises.map((e) => e.exercise_id).filter((id): id is string => id != null))].sort(),
    [exercises],
  )
  const { data: lastById } = useLastPerformances(exerciseIds)
  const { data: histories } = useExerciseHistories(exerciseIds)
  const snapshots = useMemo(() => new Map(exercises.map((e) => [
    e.id, e.exercise_id ? exerciseSnapshot(histories?.get(e.exercise_id) ?? [], e.measurement_type) : null,
  ])), [exercises, histories])
  const today = todayLocal()
  const currentId = currentExerciseId(exercises)

  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const menuExercise = exercises.find((e) => e.id === menuFor) ?? null

  const sync: SyncState = !online ? 'offline'
    : session.failedCount > 0 ? 'error'
    : session.unsavedCount > 0 ? 'saving'
    : 'saved'

  useScrollToNextExercise(currentId, exercises)

  // Leaving: the workout keeps running, but wait for pending saves first so a
  // last-second edit is not dropped when the screen unmounts.
  const [leaving, setLeaving] = useState(false)
  const leaveAnyway = useArmed(5000)
  const goBack = useCallback(() => navigate('/traning'), [navigate])
  const onBack = () => {
    if (session.unsavedCount === 0 || leaveAnyway.armed) { goBack(); return }
    if (session.failedCount > 0 || !online) {
      leaveAnyway.arm()
      toast(`${session.unsavedCount} set är inte sparade. Tryck på tillbaka igen för att lämna ändå.`, { tone: 'error', durationMs: 5000 })
      return
    }
    setLeaving(true)
  }
  // A failure while waiting cancels the exit: the banner explains, the user decides.
  if (leaving && (session.failedCount > 0 || !online)) setLeaving(false)
  useEffect(() => {
    if (leaving && session.unsavedCount === 0) goBack()
  }, [leaving, session.unsavedCount, goBack])

  const finish = async (endedAt?: string) => {
    onEnding(workout)
    const ok = await session.finish(endedAt)
    if (!ok) { onEnding(null); setFinishOpen(false); return }
    toast('Pass sparat')
    navigate('/', { replace: true })
  }

  const discard = async () => {
    onEnding(workout)
    const ok = await session.discard()
    if (!ok) { onEnding(null); setFinishOpen(false); return }
    toast('Passet slängdes', { tone: 'info' })
    navigate('/traning', { replace: true })
  }

  const allDone = session.progress.planned > 0 && session.progress.done === session.progress.planned

  return (
    <div className="min-h-dvh">
      <WorkoutHeader
        name={workout.template_name ?? 'Fritt pass'}
        startedAt={workout.started_at}
        progress={session.progress}
        sync={leaving ? 'saving' : sync}
        onBack={onBack}
      />

      <div className="mx-auto w-full max-w-2xl px-3 pb-[calc(112px+env(safe-area-inset-bottom))] pt-3 animate-fade-in">
        <SyncBanner
          online={online}
          failedCount={session.failedCount}
          unsavedCount={session.unsavedCount}
          error={session.error}
          onRetry={() => void session.retry()}
          onDismiss={session.clearError}
        />

        {exercises.length === 0 ? (
          <EmptyState
            icon="dumbbell"
            title="Lägg till din första övning"
            text="Välj övningar allt eftersom. Föregående resultat och förslag visas direkt."
            action={<Button variant="primary" size="lg" icon="plus" loading={session.busy} onClick={() => setPicker({ mode: 'add' })}>Lägg till övning</Button>}
          />
        ) : (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                statuses={session.statuses}
                last={ex.exercise_id ? lastById?.get(ex.exercise_id) : undefined}
                snapshot={snapshots.get(ex.id)}
                weightStep={weightStep}
                today={today}
                isCurrent={ex.id === currentId}
                onUpdateSet={(setId, patch) => session.updateSet(ex.id, setId, patch)}
                onToggleSet={(setId) => session.toggleComplete(ex.id, setId)}
                onAddSet={(kind) => session.addSet(ex.id, kind)}
                onRemoveSet={(set) => {
                  session.removeSet(ex.id, set.id)
                  toast('Set borttaget', { tone: 'info', action: { label: 'Ångra', onClick: () => session.restoreSet(ex.id, set) } })
                }}
                onMore={() => setMenuFor(ex.id)}
              />
            ))}
            <Button block size="lg" icon="plus" loading={session.busy} onClick={() => setPicker({ mode: 'add' })}
              className="border-dashed text-muted">
              Lägg till övning
            </Button>
          </div>
        )}
      </div>

      {/* Thumb-reachable finish, above the home indicator. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg via-bg/90 to-transparent pb-safe">
        <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-3 pt-6">
          <Button block size="lg" variant={allDone ? 'primary' : 'secondary'} icon="check"
            className={cn(!allDone && 'bg-raised/95 backdrop-blur')}
            onClick={() => setFinishOpen(true)}>
            Avsluta pass
          </Button>
        </div>
      </div>

      <ExerciseMenuSheet
        exercise={menuExercise}
        busy={session.busy}
        onClose={() => setMenuFor(null)}
        onSwap={() => { if (menuFor) setPicker({ mode: 'swap', performedExerciseId: menuFor }); setMenuFor(null) }}
        onRemove={() => {
          if (!menuFor) return
          const id = menuFor
          void session.removeExercise(id).then(() => setMenuFor(null))
        }}
      />

      <ExercisePicker
        open={picker != null}
        title={picker?.mode === 'swap' ? 'Byt övning' : 'Lägg till övning'}
        onClose={() => setPicker(null)}
        pickedIds={new Set(exerciseIds)}
        onPick={(e) => {
          if (picker?.mode === 'swap') void session.swapExercise(picker.performedExerciseId, e.id)
          // A cardio machine is usually one long set.
          else void session.addExercise(e.id, e.measurement_type === 'cardio' ? { planned_sets: 1 } : undefined)
        }}
      />

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        exercises={exercises}
        startedAt={workout.started_at}
        timeZone={workout.timezone}
        unsavedCount={session.unsavedCount}
        onFinish={finish}
        onDiscard={discard}
      />
    </div>
  )
}

/** Honest save state: unsaved sets, offline, and the last error. */
function SyncBanner({ online, failedCount, unsavedCount, error, onRetry, onDismiss }: {
  online: boolean; failedCount: number; unsavedCount: number; error: string | null
  onRetry: () => void; onDismiss: () => void
}) {
  let content: React.ReactNode = null
  if (failedCount > 0) {
    content = (
      <Banner tone="danger" action={<Button size="md" variant="secondary" onClick={onRetry}>Försök igen</Button>}>
        <p className="font-semibold">{failedCount} set är inte sparade</p>
        <p className="text-[13px] opacity-85">{online ? error ?? 'Kontrollera anslutningen.' : 'Ingen anslutning just nu.'}</p>
      </Banner>
    )
  } else if (!online) {
    content = (
      <Banner tone="warning">
        <p className="font-semibold">Ingen anslutning</p>
        <p className="text-[13px] opacity-85">
          {unsavedCount > 0 ? `${unsavedCount} set väntar på att sparas.` : 'Ändringar sparas när du är online igen.'}
        </p>
      </Banner>
    )
  } else if (error) {
    content = (
      <Banner tone="danger" action={<Button size="md" variant="ghost" onClick={onDismiss}>Stäng</Button>}>
        {error}
      </Banner>
    )
  }
  if (!content) return null
  return (
    <div className="sticky top-[calc(72px+env(safe-area-inset-top))] z-20 mb-3 rounded-2xl bg-surface shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)] animate-fade-in">
      {content}
    </div>
  )
}

/** When an exercise is finished, glide the next one into view (unless the user is typing). */
function useScrollToNextExercise(currentId: string | null, exercises: readonly { id: string; sets: readonly { completed_at: string | null }[] }[]) {
  const prev = useRef(currentId)
  useEffect(() => {
    const before = prev.current
    prev.current = currentId
    if (!currentId || !before || before === currentId) return
    const finished = exercises.find((e) => e.id === before)
    if (!finished || finished.sets.some((s) => !s.completed_at)) return
    if (document.activeElement instanceof HTMLInputElement) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`ex-${currentId}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [currentId, exercises])
}
