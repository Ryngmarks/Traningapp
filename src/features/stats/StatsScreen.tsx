import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { type ActivityRow, toFact, useActivities, useDailySteps } from '@/data/activities'
import { useExercises } from '@/data/exercises'
import { type TrainedExercise, useTrainedExercises } from '@/data/strength'
import { type HistoricalTotalRow, useHistoricalTotals } from '@/data/totals'
import { type Period, periodRange } from '@/domain/dates'
import { ACTIVITY_LABEL, CATEGORY_LABEL, formatDistance, formatDuration, formatNumber } from '@/domain/format'
import { bucketActivities, chartWindow, summarize } from '@/domain/stats'
import type { DailySteps } from '@/domain/types'
import { ACTIVITY_COLOR, ActivityIcon } from '@/ui/Badge'
import { Button, IconButton } from '@/ui/Button'
import { Card, SectionTitle } from '@/ui/Card'
import { ACTIVITY_SERIES, BarChart, seriesValues } from '@/ui/charts'
import { Icon } from '@/ui/Icon'
import { PageTitle, Screen } from '@/ui/Page'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { Stat } from '@/ui/Stat'
import { EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { todayLocal } from '@/ui/useNow'
import {
  bucketLabels, firstActivityDate, historicalSummary, isLatestPeriod, isPeriod, parseAnchor, PERIODS, periodTitle,
  shiftAnchor, trainedExercises, typeRows,
} from './helpers'

export function StatsScreen() {
  const today = todayLocal()
  const [params, setParams] = useSearchParams()
  const period: Period = isPeriod(params.get('period')) ? (params.get('period') as Period) : 'month'
  const anchor = parseAnchor(params.get('d'), today)

  const activities = useActivities()
  const totals = useHistoricalTotals()
  const steps = useDailySteps()

  // State lives in the URL so the period survives a visit to an exercise and back.
  function setPeriod(p: Period) {
    setParams(p === 'month' ? {} : { period: p }, { replace: true })
  }
  function shift(dir: -1 | 1) {
    if (period === 'all') return
    const next = shiftAnchor(period, anchor, dir)
    setParams({ period, d: next > today ? today : next }, { replace: true })
  }

  const pending = activities.isPending || totals.isPending
  const error = activities.error ?? totals.error

  return (
    <Screen>
      <PageTitle title="Statistik" />
      <SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />
      <PeriodNav period={period} anchor={anchor} today={today} onShift={shift} />

      {pending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Laddar">
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
          <Skeleton className="h-52 rounded-[var(--radius-card)]" />
          <Skeleton className="h-32 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => { activities.refetch(); totals.refetch() }} />
      ) : activities.data!.length === 0 && totals.data!.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="chart"
          title="Ingen statistik än"
          text="Logga en aktivitet eller kör ett gympass. Har du tränat innan appen kan du lägga in historik."
          action={<Link to="/installningar/historik" className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-control)] bg-raised px-4 text-[15px] font-semibold ring-1 ring-line">Lägg in historik <Icon name="chevronRight" size={16} /></Link>}
        />
      ) : (
        <PeriodStats
          period={period} anchor={anchor} today={today}
          rows={activities.data!} totals={totals.data!} dailySteps={steps.data ?? []}
        />
      )}

      <StrengthSection />
    </Screen>
  )
}

function PeriodNav({ period, anchor, today, onShift }: {
  period: Period; anchor: string; today: string; onShift: (dir: -1 | 1) => void
}) {
  const range = periodRange(period, period === 'all' ? today : anchor)
  const { title, sub } = periodTitle(period, range)
  if (period === 'all') {
    return (
      <div className="flex h-16 items-center px-1">
        <h2 className="text-[17px] font-semibold">{title}</h2>
      </div>
    )
  }
  const latest = isLatestPeriod(period, anchor, today)
  return (
    <div className="-mx-1 flex h-16 items-center gap-1">
      <IconButton icon="chevronLeft" label="Föregående period" onClick={() => onShift(-1)} />
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <h2 className="truncate text-[17px] font-semibold">{title}</h2>
        {sub && <p className="tabular text-[12px] text-faint">{sub}</p>}
      </div>
      <IconButton icon="chevronRight" label="Nästa period" disabled={latest} onClick={() => onShift(1)} />
    </div>
  )
}

function PeriodStats({ period, anchor, today, rows, totals, dailySteps }: {
  period: Period; anchor: string; today: string
  rows: ActivityRow[]; totals: HistoricalTotalRow[]; dailySteps: DailySteps[]
}) {
  const facts = useMemo(() => rows.map(toFact), [rows])
  const range = useMemo(() => periodRange(period, period === 'all' ? today : anchor), [period, anchor, today])
  const s = useMemo(() => summarize(facts, range, { totals, dailySteps }), [facts, range, totals, dailySteps])

  // Charts use dated activities only; historical totals are never spread over time.
  const chart = useMemo(() => {
    const first = firstActivityDate(facts)
    const { from, g } = chartWindow(range, first)
    const buckets = bucketActivities(facts, from, range.to, g)
    const multiYear = buckets.length > 0 && buckets[0]!.start.slice(0, 4) !== range.to.slice(0, 4)
    return {
      g,
      hasData: buckets.some((b) => b.total > 0),
      data: buckets.map((b) => {
        const l = bucketLabels(b.start, g, multiYear)
        return { key: b.start, label: l.label, title: l.title, values: seriesValues(b.counts) }
      }),
    }
  }, [facts, range])

  const allTime = period === 'all'
  const types = typeRows(s.sessions)
  const maxType = Math.max(1, ...types.map((t) => t.count))
  const walkRun = s.walkRunDistanceM > 0
  const chartUnit = chart.g === 'day' ? 'dag' : chart.g === 'week' ? 'vecka' : 'månad'

  if (s.totalSessions === 0 && s.steps === 0) {
    return (
      <EmptyState className="py-8" icon="chart" title="Inget registrerat"
        text={EMPTY_TEXT[period]} />
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Stat label="Pass" value={formatNumber(s.totalSessions)} accent />
          <Stat label="Total tid" value={s.durationS > 0 ? formatDuration(s.durationS) : '–'} />
          <Stat label="Gång och löpning" value={walkRun ? formatDistance(s.walkRunDistanceM) : '–'} />
          <Stat label="Steg" value={s.steps > 0 ? formatNumber(s.steps) : '–'} sub={s.steps > 0 ? 'registrerade' : undefined} />
        </div>
        {allTime && (s.historicalSessions > 0 || s.coveredActivities > 0) && (
          <div className="mt-4 space-y-1.5 border-t border-line/70 pt-3 text-[12px] leading-relaxed text-faint">
            {s.historicalSessions > 0 && (
              <p className="flex gap-2">
                <Icon name="history" size={15} className="mt-px shrink-0" />
                <span>Inkluderar historik utan datum: {historicalSummary(totals)}.</span>
              </p>
            )}
            {s.coveredActivities > 0 && (
              <p className="flex gap-2">
                <Icon name="info" size={15} className="mt-px shrink-0" />
                <span>
                  {formatNumber(s.coveredActivities)} daterade pass ingår redan i historiken och räknas inte två gånger.{' '}
                  <Link to="/installningar/historik" className="font-medium text-muted underline underline-offset-2">Historik</Link>
                </span>
              </p>
            )}
          </div>
        )}
      </Card>

      {types.length > 0 && (
        <>
          <SectionTitle>Pass per typ</SectionTitle>
          <Card className="space-y-3.5">
            {types.map((t) => (
              <div key={t.type} className="flex items-center gap-3">
                <ActivityIcon type={t.type} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-medium">{ACTIVITY_LABEL[t.type]}</span>
                    <span className="tabular text-[15px] font-semibold">{formatNumber(t.count)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full" style={{ width: `${(t.count / maxType) * 100}%`, background: ACTIVITY_COLOR[t.type] }} />
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle action={<span className="text-[12px] text-faint">pass per {chartUnit}</span>}>Frekvens</SectionTitle>
      <Card className="pb-3 pt-5">
        {chart.hasData ? (
          <BarChart
            ariaLabel={`Pass per ${chartUnit}`}
            data={chart.data}
            series={ACTIVITY_SERIES}
            integer
            height={160}
            formatValue={(v) => `${v} st`}
          />
        ) : (
          <p className="py-6 text-center text-[13px] text-faint">Inga daterade pass att visa.</p>
        )}
        {allTime && s.historicalSessions > 0 && (
          <p className="mt-2 text-[12px] text-faint">Diagrammet visar bara daterade pass.</p>
        )}
      </Card>

      {walkRun && (
        <>
          <SectionTitle>Gång och löpning</SectionTitle>
          <Card>
            <div className="grid grid-cols-2 gap-x-4">
              <Stat label="Löpning" value={formatDistance(s.runDistanceM)} />
              <Stat label="Promenad" value={formatDistance(s.walkDistanceM)} />
            </div>
            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              {s.runDistanceM > 0 && <div style={{ flexGrow: s.runDistanceM, background: ACTIVITY_COLOR.run }} />}
              {s.walkDistanceM > 0 && <div style={{ flexGrow: s.walkDistanceM, background: ACTIVITY_COLOR.walk }} />}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

const EMPTY_TEXT: Record<Period, string> = {
  week: 'Ingen aktivitet den här veckan.',
  month: 'Ingen aktivitet den här månaden.',
  year: 'Ingen aktivitet det här året.',
  all: 'Ingen aktivitet registrerad.',
}

const STRENGTH_PREVIEW = 6

function StrengthSection() {
  const ids = useTrainedExercises()
  const exercises = useExercises()
  const [showAll, setShowAll] = useState(false)
  const list = useMemo(() => trainedExercises<TrainedExercise>(ids.data ?? [], exercises.data ?? []), [ids.data, exercises.data])
  const pending = ids.isPending || exercises.isPending
  const error = ids.error ?? exercises.error
  const shown = showAll ? list : list.slice(0, STRENGTH_PREVIEW)

  return (
    <section aria-labelledby="strength-title">
      <SectionTitle><span id="strength-title">Styrka</span></SectionTitle>
      {pending ? (
        <Skeleton className="h-36 rounded-[var(--radius-card)]" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => { ids.refetch(); exercises.refetch() }} />
      ) : list.length === 0 ? (
        <Card className="flex items-center gap-3 text-[14px] text-muted">
          <Icon name="dumbbell" size={20} className="shrink-0 text-faint" />
          Kör ett gympass så syns dina övningar här.
        </Card>
      ) : (
        <>
          <div className="-mx-1 rounded-[var(--radius-card)] border border-line/70 bg-surface p-1">
            {shown.map((e) => (
              <Link key={e.id} to={`/statistik/ovning/${e.id}`}
                className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-raised/60 active:bg-raised">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{e.name}</div>
                  <div className="truncate text-[12px] text-faint">{CATEGORY_LABEL[e.category]}</div>
                </div>
                <Icon name="chevronRight" size={18} className="text-faint" />
              </Link>
            ))}
          </div>
          {list.length > STRENGTH_PREVIEW && (
            <Button className="mt-2" block variant="ghost" icon={showAll ? 'chevronUp' : 'chevronDown'} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Visa färre' : `Visa alla (${list.length})`}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
