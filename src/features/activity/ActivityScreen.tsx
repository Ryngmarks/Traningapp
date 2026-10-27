import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useActivities } from '@/data/activities'
import { ACTIVITY_COLOR } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import { PageTitle, Screen } from '@/ui/Page'
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States'
import { todayLocal } from '@/ui/useNow'
import { ActivityListItem, QUICK_TYPES } from './ActivityListItem'
import { type ActivityFilter, groupByWeek, matchesFilter, weekRangeLabel } from './helpers'

const FILTERS: readonly { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'Alla' },
  { value: 'gym', label: 'Gym' },
  { value: 'football', label: 'Fotboll' },
  { value: 'run', label: 'Löpning' },
  { value: 'walk', label: 'Promenad' },
  { value: 'other', label: 'Övrigt' },
]
const PAGE = 80

export function ActivityScreen() {
  const { data, isPending, error, refetch } = useActivities()
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.find((f) => f.value === params.get('filter'))?.value ?? 'all')
  const [limit, setLimit] = useState(PAGE)
  const today = todayLocal()
  const navigate = useNavigate()

  const filtered = useMemo(() => (data ?? []).filter((a) => matchesFilter(a.type, filter)), [data, filter])
  const groups = useMemo(() => groupByWeek(filtered.slice(0, limit)), [filtered, limit])

  function setFilter(f: ActivityFilter) {
    setLimit(PAGE)
    setParams(f === 'all' ? {} : { filter: f }, { replace: true })
  }

  return (
    <Screen>
      <PageTitle title="Aktivitet" />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Logga aktivitet">
        {QUICK_TYPES.map((q) => (
          <Link key={q.type} to={`/aktivitet/ny?typ=${q.type}`}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 text-[14px] font-semibold transition-[transform,border-color] active:scale-[0.97] hover:border-line-strong">
            <span className="grid size-6 place-items-center rounded-full" style={{ color: ACTIVITY_COLOR[q.type], background: `color-mix(in srgb, ${ACTIVITY_COLOR[q.type]} 14%, transparent)` }}>
              <Icon name="plus" size={14} strokeWidth={2.25} />
            </span>
            {q.label}
          </Link>
        ))}
      </div>

      <div role="radiogroup" aria-label="Filtrera på typ" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)}
            className={cn('h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              filter === f.value ? 'bg-fg text-bg' : 'bg-raised text-muted hover:text-fg')}>
            {f.label}
          </button>
        ))}
      </div>

      {isPending ? <ListSkeleton rows={6} />
        : error ? <ErrorState error={error} onRetry={() => refetch()} />
        : filtered.length === 0 ? (
          <EmptyState
            icon="activity"
            title={filter === 'all' ? 'Inga aktiviteter än' : 'Inget här än'}
            text={filter === 'all' ? 'Logga en fotbollsträning, löprunda eller promenad, eller kör ett gympass under Träna.' : 'Inga aktiviteter av den här typen.'}
            action={filter === 'all'
              ? <Button variant="primary" icon="plus" onClick={() => navigate('/aktivitet/ny?typ=run')}>Logga aktivitet</Button>
              : <Button variant="ghost" onClick={() => setFilter('all')}>Visa alla</Button>}
          />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.weekStart} aria-labelledby={`w-${g.weekStart}`}>
                <div className="mb-1 flex items-baseline justify-between px-1">
                  <h2 id={`w-${g.weekStart}`} className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Vecka {g.week}</h2>
                  <span className="text-[12px] text-faint">{weekRangeLabel(g.weekStart, today)} · {g.items.length} st</span>
                </div>
                <div className="-mx-1 rounded-[var(--radius-card)] border border-line/70 bg-surface p-1">
                  {g.items.map((a) => <ActivityListItem key={a.id} a={a} />)}
                </div>
              </section>
            ))}
            {filtered.length > limit && (
              <Button block variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Visa fler ({filtered.length - limit} kvar)</Button>
            )}
          </div>
        )}
    </Screen>
  )
}
