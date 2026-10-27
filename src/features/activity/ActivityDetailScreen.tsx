import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { type ActivityRow, useActivities, useDeleteActivity } from '@/data/activities'
import { keys } from '@/data/queryClient'
import { fetchWorkout, type PerformedExercise } from '@/data/workout'
import {
  ACTIVITY_LABEL, formatDistance, formatDuration, formatLongDate, formatNumber, formatPace, formatWeight,
  paceSecondsPerKm, SOURCE_LABEL,
} from '@/domain/format'
import { totalVolume } from '@/domain/progression'
import { ActivityIcon, Pill } from '@/ui/Badge'
import { Button, IconButton } from '@/ui/Button'
import { Card, SectionTitle } from '@/ui/Card'
import { Screen, SubHeader } from '@/ui/Page'
import { Stat } from '@/ui/Stat'
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { activityTitle, zonedParts } from './helpers'

export function ActivityDetailScreen() {
  const { id = '' } = useParams()
  const { data, isPending, error, refetch } = useActivities()
  const row = data?.find((a) => a.id === id)

  return (
    <Screen>
      <SubHeader title={row ? activityTitle(row) : 'Aktivitet'} back="/aktivitet"
        action={row && row.type !== 'gym' ? <EditButton id={row.id} /> : undefined} />
      {isPending ? (
        <div className="space-y-3"><Skeleton className="h-28 rounded-[var(--radius-card)]" /><Skeleton className="h-40 rounded-[var(--radius-card)]" /></div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !row ? (
        <EmptyState icon="search" title="Aktiviteten finns inte" text="Den kan ha tagits bort." />
      ) : (
        <Detail a={row} />
      )}
    </Screen>
  )
}

function EditButton({ id }: { id: string }) {
  const navigate = useNavigate()
  return <IconButton icon="edit" label="Redigera" onClick={() => navigate(`/aktivitet/${id}/redigera`)} />
}

function Detail({ a }: { a: ActivityRow }) {
  const time = zonedParts(a.started_at, a.timezone).time
  const dist = a.metrics?.distance_m ?? null
  const pace = a.type === 'run' || a.type === 'walk' ? paceSecondsPerKm(dist, a.duration_s) : null
  const stats: { label: string; value: string; unit?: string }[] = []
  if (a.duration_s != null) stats.push({ label: 'Tid', value: formatDuration(a.duration_s) })
  if (dist != null) stats.push({ label: 'Distans', value: formatDistance(dist) })
  if (pace != null) stats.push({ label: 'Tempo', value: formatPace(pace) })
  if (a.metrics?.steps != null) stats.push({ label: 'Steg', value: formatNumber(a.metrics.steps) })
  if (a.metrics?.avg_heart_rate != null) stats.push({ label: 'Snittpuls', value: String(a.metrics.avg_heart_rate), unit: 'bpm' })
  if (a.metrics?.max_heart_rate != null) stats.push({ label: 'Maxpuls', value: String(a.metrics.max_heart_rate), unit: 'bpm' })
  if (a.perceived_exertion != null) stats.push({ label: 'Ansträngning', value: String(a.perceived_exertion), unit: '/10' })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3.5 px-1 pt-1">
        <ActivityIcon type={a.type} size={52} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted">{ACTIVITY_LABEL[a.type]}</div>
          <div className="text-[20px] font-semibold leading-tight">{formatLongDate(a.local_date)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-faint">
            kl. {time}
            {a.source !== 'manual' && <Pill className="h-5 px-2 text-[11px]">{SOURCE_LABEL[a.source]}</Pill>}
          </div>
        </div>
      </div>

      {stats.length > 0 && (
        <Card className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} unit={s.unit} />)}
        </Card>
      )}

      {a.notes && (
        <Card>
          <div className="mb-1 text-[12px] font-medium text-muted">Anteckning</div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.notes}</p>
        </Card>
      )}

      {a.type === 'gym' && <GymSets id={a.id} />}

      <DeleteActivity id={a.id} />
    </div>
  )
}

function GymSets({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useQuery({ queryKey: keys.activity(id), queryFn: () => fetchWorkout(id) })
  if (isPending) return <ListSkeleton rows={3} />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const all = data.exercises.flatMap((e) => e.sets.filter((s) => s.completed_at))
  const volume = totalVolume(all)
  return (
    <div>
      <SectionTitle action={volume > 0 ? <span className="tabular text-[13px] text-muted">{formatWeight(Math.round(volume))} totalt</span> : undefined}>
        Övningar
      </SectionTitle>
      {data.exercises.length === 0 ? (
        <Card className="text-[14px] text-muted">Inga övningar registrerades.</Card>
      ) : (
        <div className="space-y-2.5">
          {data.exercises.map((e) => <ExerciseCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  )
}

function setText(s: PerformedExercise['sets'][number], m: PerformedExercise['measurement_type']): string {
  switch (m) {
    case 'weight_reps': return `${formatWeight(s.weight_kg)} × ${s.reps ?? '–'}`
    case 'bodyweight_reps': return s.weight_kg ? `+${formatWeight(s.weight_kg)} × ${s.reps ?? '–'}` : `${s.reps ?? '–'} reps`
    case 'duration': return formatDuration(s.duration_s)
    case 'distance': return formatDistance(s.distance_m)
  }
}

function ExerciseCard({ e }: { e: PerformedExercise }) {
  const done = e.sets.filter((s) => s.completed_at)
  const volume = totalVolume(done)
  let working = 0
  return (
    <Card className="p-3.5">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h3 className="min-w-0 truncate text-[15px] font-semibold">{e.exercise_name}</h3>
        {volume > 0 && <span className="tabular shrink-0 text-[12px] text-muted">{formatWeight(Math.round(volume))}</span>}
      </div>
      {done.length === 0 ? (
        <p className="mt-1 px-0.5 text-[13px] text-faint">Inga genomförda set</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {done.map((s) => {
            const warm = s.kind === 'warmup'
            if (!warm) working++
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-lg px-0.5 text-[14px]">
                <span className={warm ? 'w-6 text-center text-[11px] font-semibold text-warning' : 'tabular w-6 text-center text-[12px] font-semibold text-faint'}>
                  {warm ? 'UV' : working}
                </span>
                <span className={warm ? 'tabular text-muted' : 'tabular'}>{setText(s, e.measurement_type)}</span>
                {warm && <span className="text-[12px] text-faint">uppvärmning</span>}
              </li>
            )
          })}
        </ol>
      )}
      {e.notes && <p className="mt-2 px-0.5 text-[13px] text-muted">{e.notes}</p>}
    </Card>
  )
}

function DeleteActivity({ id }: { id: string }) {
  const del = useDeleteActivity()
  const toast = useToast()
  const navigate = useNavigate()
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  function onClick() {
    if (!armed) { setArmed(true); return }
    del.mutate(id, {
      onSuccess: () => { toast('Borttaget'); navigate('/aktivitet', { replace: true }) },
      onError: (err) => { setArmed(false); toast(err.message, { tone: 'error' }) },
    })
  }
  return (
    <div className="pt-4">
      <Button block variant={armed ? 'danger' : 'ghost'} icon="trash" loading={del.isPending} onClick={onClick}>
        {armed ? 'Tryck igen för att ta bort' : 'Ta bort aktivitet'}
      </Button>
    </div>
  )
}
