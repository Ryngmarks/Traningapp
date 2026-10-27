import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type ActivityRow, toFact, useActivities, useDailySteps } from '@/data/activities'
import { DataError } from '@/data/errors'
import { type Profile, useProfile } from '@/data/profile'
import { useUserId } from '@/data/auth'
import { isOwnTemplate, useTemplates } from '@/data/templates'
import { useHistoricalTotals } from '@/data/totals'
import { startWorkout, useActiveWorkout } from '@/data/workout'
import { periodRange } from '@/domain/dates'
import { formatDay, formatDistance, formatDuration, formatNumber, formatRelativeDay } from '@/domain/format'
import { activeDays, bucketActivities, summarize } from '@/domain/stats'
import { ActivityIcon } from '@/ui/Badge'
import { Button, IconButton } from '@/ui/Button'
import { Card, LinkCard, SectionTitle } from '@/ui/Card'
import { ACTIVITY_SERIES, BarChart, seriesValues } from '@/ui/charts'
import { Icon } from '@/ui/Icon'
import { PageTitle, Screen } from '@/ui/Page'
import { Stat } from '@/ui/Stat'
import { EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { todayLocal, useNow } from '@/ui/useNow'
import { greeting, lastDays, pickNextTemplate, weekdayShort } from './helpers'

const longDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

const QUICK_LOG = [
  { type: 'football_training', label: 'Fotboll' },
  { type: 'run', label: 'Löpning' },
  { type: 'walk', label: 'Promenad' },
] as const

export function OverviewScreen() {
  const navigate = useNavigate()
  const now = useNow(60_000)
  const profile = useProfile()
  const activities = useActivities()
  const totals = useHistoricalTotals()
  const steps = useDailySteps()

  // useProfile().data is typed `null` by unwrap() inference on .single(); see report.
  const name = (profile.data as Profile | null | undefined)?.display_name?.trim()
  const dateText = longDate.format(new Date(now))
  const title = `${greeting(new Date(now).getHours())}${name ? `, ${name.split(' ')[0]}` : ''}`

  const pending = activities.isPending || totals.isPending
  const error = activities.error ?? totals.error
  const isEmpty = !pending && !error && activities.data!.length === 0 && totals.data!.length === 0

  return (
    <Screen>
      <PageTitle
        subtitle={dateText.charAt(0).toUpperCase() + dateText.slice(1)}
        title={title}
        action={<IconButton icon="settings" label="Inställningar" variant="secondary" size={44} onClick={() => navigate('/installningar')} />}
      />

      <StartCard gymSessions={activities.data} />

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {QUICK_LOG.map((q) => (
          <Link key={q.type} to={`/aktivitet/ny?typ=${q.type}`}
            className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-line/70 bg-surface px-2 py-3.5 transition-[transform,border-color] active:scale-[0.97] hover:border-line-strong">
            <ActivityIcon type={q.type} size={36} />
            <span className="text-[13px] font-semibold">{q.label}</span>
          </Link>
        ))}
      </div>

      {pending ? (
        <div className="mt-7 space-y-3" aria-busy="true" aria-label="Laddar">
          <Skeleton className="h-44 rounded-[var(--radius-card)]" />
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => { activities.refetch(); totals.refetch() }} />
      ) : isEmpty ? (
        <EmptyState
          className="mt-4"
          icon="sparkle"
          title="Välkommen!"
          text="Starta ditt första gympass eller logga en träning ovan. Har du tränat innan appen kan du lägga in historik under Inställningar."
        />
      ) : (
        <Summary rows={activities.data!} totals={totals.data!} dailySteps={steps.data ?? []} />
      )}
    </Screen>
  )
}

function StartCard({ gymSessions }: { gymSessions: ActivityRow[] | undefined }) {
  const navigate = useNavigate()
  const toast = useToast()
  const active = useActiveWorkout()
  const templates = useTemplates()
  const userId = useUserId()
  const [starting, setStarting] = useState(false)

  const next = useMemo(
    () => {
      // Suggest from the user's own templates; fall back to the shared starter templates.
      const all = templates.data ?? []
      const own = all.filter((t) => isOwnTemplate(t, userId))
      return pickNextTemplate(own.length > 0 ? own : all.filter((t) => t.user_id === null),
        (gymSessions ?? []).filter((a) => a.type === 'gym'))
    },
    [templates.data, gymSessions, userId],
  )

  async function start(templateId: string | null) {
    setStarting(true)
    try {
      await startWorkout(templateId)
      navigate('/traning/pass')
    } catch (e) {
      if (e instanceof DataError && e.code === 'active_workout_exists') navigate('/traning/pass')
      else toast(e instanceof Error ? e.message : 'Kunde inte starta passet.', { tone: 'error' })
    } finally {
      setStarting(false)
    }
  }

  if (active.isPending || templates.isPending) return <Skeleton className="h-[148px] rounded-[var(--radius-card)]" />

  if (active.data) {
    return (
      <Card className="border-accent/30 bg-[linear-gradient(135deg,rgb(200_241_105/0.10),transparent_60%)]">
        <div className="flex items-center gap-2 text-[13px] font-medium text-accent">
          <span className="size-2 rounded-full bg-accent" /> Pågående pass
        </div>
        <div className="mt-1 truncate text-[22px] font-semibold tracking-[-0.02em]">{active.data.template_name ?? 'Gympass'}</div>
        <Button className="mt-4" variant="primary" size="lg" block icon="play" onClick={() => navigate('/traning/pass')}>Fortsätt pass</Button>
      </Card>
    )
  }

  return (
    <Card className="bg-[linear-gradient(135deg,rgb(200_241_105/0.07),transparent_55%)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-medium text-muted">{next ? 'Nästa pass' : 'Gym'}</div>
        <Link to="/traning" className="-my-2 flex h-9 items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-fg">
          {next ? 'Alla pass' : 'Skapa pass'} <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {next ? (
        <>
          <div className="mt-0.5 truncate text-[22px] font-semibold tracking-[-0.02em]">{next.name}</div>
          <div className="text-[13px] text-faint">{next.items.length} {next.items.length === 1 ? 'övning' : 'övningar'}</div>
          <Button className="mt-4" variant="primary" size="lg" block icon="play" loading={starting} onClick={() => start(next.id)}>Starta pass</Button>
        </>
      ) : (
        <>
          <div className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">Inga sparade pass</div>
          <div className="text-[13px] text-faint">Starta ett tomt pass och lägg till övningar medan du kör.</div>
          <Button className="mt-4" variant="primary" size="lg" block icon="play" loading={starting} onClick={() => start(null)}>Starta tomt pass</Button>
        </>
      )}
    </Card>
  )
}

function Summary({ rows, totals, dailySteps }: {
  rows: ActivityRow[]
  totals: NonNullable<ReturnType<typeof useHistoricalTotals>['data']>
  dailySteps: NonNullable<ReturnType<typeof useDailySteps>['data']>
}) {
  const today = todayLocal()
  const facts = useMemo(() => rows.map(toFact), [rows])
  const all = useMemo(() => summarize(facts, periodRange('all', today), { totals, dailySteps }), [facts, today, totals, dailySteps])
  const from = lastDays(today, 7)[0]!
  const buckets = useMemo(() => bucketActivities(facts, from, today, 'day'), [facts, from, today])
  const active = activeDays(facts, today, 7)
  const latestGym = rows.find((a) => a.type === 'gym')

  return (
    <>
      <SectionTitle action={<span className="text-[13px] text-muted"><span className="tabular font-semibold text-fg">{active}</span> av 7 dagar aktiv</span>}>
        Senaste 7 dagarna
      </SectionTitle>
      <Card className="pb-3 pt-5">
        <BarChart
          ariaLabel={`Aktiviteter per dag de senaste 7 dagarna. ${active} aktiva dagar.`}
          data={buckets.map((b) => ({
            key: b.start,
            label: b.start === today ? 'idag' : weekdayShort(b.start),
            title: formatDay(b.start),
            values: seriesValues(b.counts),
          }))}
          series={ACTIVITY_SERIES}
          height={112}
          integer
          showYAxis={false}
          formatValue={(v) => `${v} st`}
        />
      </Card>

      <SectionTitle>Totalt</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Stat label="Pass" value={formatNumber(all.totalSessions)} accent />
          <Stat label="Gymbesök" value={formatNumber(all.gymSessions)} />
          <Stat label="Fotboll" value={formatNumber(all.footballSessions)} sub="träning och match" />
          <Stat label="Gång och löpning" value={formatDistance(all.walkRunDistanceM)} />
        </div>
        {all.historicalSessions > 0 && (
          <p className="mt-4 border-t border-line/70 pt-3 text-[12px] text-faint">
            Inkluderar {formatNumber(all.historicalSessions)} historiska pass utan datum.
          </p>
        )}
      </Card>

      {latestGym && (
        <>
          <SectionTitle>Senaste gympass</SectionTitle>
          <LinkCard to={`/aktivitet/${latestGym.id}`}>
            <div className="flex items-center gap-3">
              <ActivityIcon type="gym" size={40} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{latestGym.template_name ?? latestGym.title ?? 'Gympass'}</div>
                <div className="text-[13px] text-muted">
                  {formatRelativeDay(latestGym.local_date, today)}
                  {latestGym.duration_s != null && ` · ${formatDuration(latestGym.duration_s)}`}
                </div>
              </div>
            </div>
          </LinkCard>
        </>
      )}
    </>
  )
}
