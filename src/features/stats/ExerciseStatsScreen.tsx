import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useExercises } from '@/data/exercises'
import { useExerciseHistory, useTrainedExercises } from '@/data/strength'
import { CATEGORY_LABEL, formatDistance, formatDuration, formatLongDate, formatNumber, formatShortDate, formatWeight } from '@/domain/format'
import { personalBests, sessionSummaries } from '@/domain/progression'
import type { CompletedSet, MeasurementType } from '@/domain/types'
import { Card, SectionTitle } from '@/ui/Card'
import { BarChart, LineChart } from '@/ui/charts'
import { Icon } from '@/ui/Icon'
import { Screen, SubHeader } from '@/ui/Page'
import { Stat } from '@/ui/Stat'
import { EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { groupSessions, inferMeasurement, sessionBest, setsLine } from './exerciseHelpers'

const RECENT = 8
const VOLUME_BARS = 16

export function ExerciseStatsScreen() {
  const { id } = useParams()
  const exercises = useExercises()
  const history = useExerciseHistory(id)
  const trained = useTrainedExercises()
  // Archived exercises are not in the library list; fall back to the history snapshot.
  const exercise = exercises.data?.find((e) => e.id === id) ?? trained.data?.find((e) => e.id === id)

  return (
    <Screen>
      <SubHeader title={exercise?.name ?? 'Övning'} back="/statistik" />
      {history.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Laddar">
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-56 rounded-[var(--radius-card)]" />
        </div>
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.length === 0 ? (
        <EmptyState icon="dumbbell" title="Ingen historik" text="Övningen har inga genomförda set än." />
      ) : (
        <ExerciseStats
          history={history.data}
          measurement={exercise?.measurement_type ?? inferMeasurement(history.data)}
          category={exercise ? CATEGORY_LABEL[exercise.category] : null}
        />
      )}
    </Screen>
  )
}

function ExerciseStats({ history, measurement, category }: {
  history: CompletedSet[]; measurement: MeasurementType; category: string | null
}) {
  const pb = useMemo(() => personalBests(history), [history])
  const summaries = useMemo(() => sessionSummaries(history), [history])
  const sessions = useMemo(() => groupSessions(history), [history])
  const reps = measurement === 'weight_reps' || measurement === 'bodyweight_reps'
  const first = sessions[sessions.length - 1]

  const bests: { label: string; value: string; sub?: string }[] = []
  if (measurement === 'weight_reps') {
    if (pb.heaviest) bests.push({ label: 'Tyngsta set', value: formatWeight(pb.heaviest.weightKg), sub: `× ${pb.heaviest.reps} · ${formatShortDate(pb.heaviest.date)}` })
    if (pb.bestEstimated1RM) bests.push({ label: 'Est. 1RM', value: formatWeight(pb.bestEstimated1RM.value), sub: `${formatWeight(pb.bestEstimated1RM.weightKg)} × ${pb.bestEstimated1RM.reps}` })
  }
  if (reps && pb.mostReps) {
    bests.push({ label: 'Flest reps', value: String(pb.mostReps.reps), sub: pb.mostReps.weightKg ? `med ${formatWeight(pb.mostReps.weightKg)}` : formatShortDate(pb.mostReps.date) })
  }
  if (measurement === 'bodyweight_reps' && pb.heaviest) {
    bests.push({ label: 'Tyngsta tillägg', value: `+${formatWeight(pb.heaviest.weightKg)}`, sub: `× ${pb.heaviest.reps}` })
  }
  if (reps && pb.bestSessionVolume) {
    bests.push({ label: 'Bästa volym', value: formatWeight(Math.round(pb.bestSessionVolume.volume)), sub: formatShortDate(pb.bestSessionVolume.date) })
  }
  if ((measurement === 'duration' || measurement === 'cardio') && pb.longestDuration) {
    bests.push({ label: 'Längsta tid', value: formatDuration(pb.longestDuration.seconds), sub: formatShortDate(pb.longestDuration.date) })
  }
  if ((measurement === 'distance' || measurement === 'cardio') && pb.longestDistance) {
    bests.push({ label: 'Längsta distans', value: formatDistance(pb.longestDistance.meters), sub: formatShortDate(pb.longestDistance.date) })
  }

  // Strength over time: one point per workout, placed by date.
  const xOf = (d: string) => Date.parse(`${d}T00:00:00Z`)
  const strengthLine = summaries
    .filter((s) => s.topWeightKg != null && s.topWeightKg > 0)
    .map((s) => ({
      key: s.activityId, x: xOf(s.date), label: formatShortDate(s.date), title: formatLongDate(s.date),
      values: { top: s.topWeightKg, e1rm: s.bestE1RM },
    }))
  const hasE1rm = strengthLine.some((p) => p.values.e1rm != null)
  const timedKind = measurement === 'duration' || measurement === 'distance' ? measurement
    : measurement === 'cardio' ? (sessions.some((s) => s.sets.some((x) => x.distance_m != null)) ? 'distance' : 'duration')
    : null
  const timedLine = timedKind
    ? [...sessions].reverse()
      .map((s) => ({ s, v: sessionBest(s, timedKind) }))
      .filter((p): p is { s: typeof p.s; v: number } => p.v != null)
      .map(({ s, v }) => ({ key: s.activityId, x: xOf(s.date), label: formatShortDate(s.date), title: formatLongDate(s.date), values: { best: v } }))
    : []
  const volumeBars = summaries.filter((s) => s.volume > 0).slice(-VOLUME_BARS).map((s) => ({
    key: s.activityId, label: formatShortDate(s.date), title: formatLongDate(s.date), values: { volume: Math.round(s.volume) },
  }))

  return (
    <div className="space-y-3 animate-fade-in">
      <p className="px-1 text-[13px] text-muted">
        {category && <>{category} · </>}
        {formatNumber(sessions.length)} pass
        {first && <> sedan {formatShortDate(first.date)} {first.date.slice(0, 4)}</>}
      </p>

      {bests.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            <Icon name="trophy" size={15} className="text-accent" /> Rekord
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {bests.map((b, i) => <Stat key={b.label} label={b.label} value={b.value} sub={b.sub} accent={i === 0} />)}
          </div>
        </Card>
      )}

      {strengthLine.length >= 2 && (
        <>
          <SectionTitle>Utveckling</SectionTitle>
          <Card className="pt-5">
            <LineChart
              ariaLabel="Toppvikt och uppskattad 1RM per pass"
              data={strengthLine}
              series={hasE1rm
                ? [{ key: 'top', label: 'Toppvikt', color: 'var(--color-accent)' }, { key: 'e1rm', label: 'Est. 1RM', color: 'var(--color-act-football)' }]
                : [{ key: 'top', label: 'Toppvikt', color: 'var(--color-accent)' }]}
              formatValue={(v) => formatWeight(v)}
            />
          </Card>
        </>
      )}

      {timedLine.length >= 2 && (
        <>
          <SectionTitle>Utveckling</SectionTitle>
          <Card className="pt-5">
            <LineChart
              ariaLabel={timedKind === 'duration' ? 'Längsta tid per pass' : 'Längsta distans per pass'}
              data={timedLine}
              series={[{ key: 'best', label: timedKind === 'duration' ? 'Längsta tid' : 'Längsta distans', color: 'var(--color-accent)' }]}
              formatValue={(v) => (timedKind === 'duration' ? formatDuration(v, 'clock') : formatDistance(v))}
            />
          </Card>
        </>
      )}

      {volumeBars.length >= 2 && (
        <>
          <SectionTitle action={<span className="text-[12px] text-faint">kg × reps per pass</span>}>Volym</SectionTitle>
          <Card className="pb-3 pt-5">
            <BarChart
              ariaLabel="Volym per pass (kg × reps)"
              data={volumeBars}
              series={[{ key: 'volume', label: 'Volym', color: 'var(--color-act-gym)' }]}
              height={140}
              formatValue={(v) => formatWeight(v)}
            />
          </Card>
        </>
      )}

      <SectionTitle>Senaste passen</SectionTitle>
      <div className="-mx-1 rounded-[var(--radius-card)] border border-line/70 bg-surface p-1">
        {sessions.slice(0, RECENT).map((s) => (
          <Link key={s.activityId} to={`/aktivitet/${s.activityId}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-raised/60 active:bg-raised">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-muted">{formatLongDate(s.date)}</div>
              <div className="tabular mt-0.5 text-[15px]">{setsLine(s.sets, measurement)}</div>
            </div>
            <Icon name="chevronRight" size={18} className="shrink-0 text-faint" />
          </Link>
        ))}
      </div>
    </div>
  )
}
