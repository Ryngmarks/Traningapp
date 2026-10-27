import { Link, useNavigate } from 'react-router'
import { formatDuration } from '@/domain/format'
import { elapsedSeconds, workoutProgress } from '@/domain/workout'
import { type Template, useTemplates } from '@/data/templates'
import { type ActiveWorkout, useActiveWorkout } from '@/data/workout'
import { Button } from '@/ui/Button'
import { LinkCard, SectionTitle } from '@/ui/Card'
import { Icon } from '@/ui/Icon'
import { PageTitle, Screen } from '@/ui/Page'
import { Spinner } from '@/ui/Spinner'
import { EmptyState, ErrorState, Skeleton } from '@/ui/States'
import { useNow } from '@/ui/useNow'
import { useStartWorkout } from './useStartWorkout'

const secondaryLink =
  'inline-flex items-center justify-center font-semibold tracking-[-0.01em] border border-line bg-raised text-fg transition-[transform,border-color] duration-150 hover:border-line-strong active:scale-[0.97]'

export function TrainScreen() {
  const active = useActiveWorkout()
  const templates = useTemplates()
  const starter = useStartWorkout()

  return (
    <Screen>
      <PageTitle title="Träna" action={
        <Link to="/traning/ovningar" aria-label="Övningsbibliotek" title="Övningsbibliotek"
          className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-fg">
          <Icon name="book" size={22} />
        </Link>
      } />

      {active.data && <ContinueCard workout={active.data} />}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" icon="play" loading={starter.isStarting(null)} disabled={starter.isPending}
          onClick={() => starter.start(null)}>
          Fritt pass
        </Button>
        <Link to="/traning/mallar/ny" className={`${secondaryLink} h-14 gap-2.5 rounded-2xl px-5 text-base`}>
          <Icon name="plus" size={20} />
          Ny mall
        </Link>
      </div>

      <SectionTitle>Mallar</SectionTitle>
      {templates.isPending ? <TemplatesSkeleton />
        : templates.error ? <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
        : templates.data.length === 0 ? (
          <EmptyState icon="dumbbell" title="Inga mallar än"
            text="Spara dina vanliga pass som mallar, så startar du dem med ett tryck."
            action={
              <Link to="/traning/mallar/ny"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-4 text-[15px] font-semibold text-on-accent active:scale-[0.97]">
                <Icon name="plus" size={20} />Skapa mall
              </Link>
            } />
        ) : (
          <ul className="space-y-3">
            {templates.data.map((t) => (
              <li key={t.id}>
                <TemplateCard template={t} starting={starter.isStarting(t.id)} disabled={starter.isPending}
                  onStart={() => starter.start(t.id)} />
              </li>
            ))}
          </ul>
        )}

      <SectionTitle>Bibliotek</SectionTitle>
      <LinkCard to="/traning/ovningar">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-raised text-muted"><Icon name="book" size={20} /></div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">Övningsbibliotek</div>
            <div className="truncate text-[13px] text-muted">Sök, läs instruktioner, skapa egna</div>
          </div>
        </div>
      </LinkCard>

      {/* Room for the floating "running workout" pill above the tab bar. */}
      {active.data && <div className="h-14" aria-hidden="true" />}
    </Screen>
  )
}

function ContinueCard({ workout }: { workout: ActiveWorkout }) {
  const navigate = useNavigate()
  const now = useNow(1000)
  const p = workoutProgress(workout.exercises)
  return (
    <button type="button" onClick={() => navigate('/traning/pass')}
      className="mb-4 flex w-full items-center gap-4 rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4 text-left transition-transform duration-150 animate-fade-in active:scale-[0.99]">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
        <Icon name="play" size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-accent">Fortsätt pass</div>
        <div className="truncate text-[17px] font-semibold">{workout.template_name ?? 'Fritt pass'}</div>
        <div className="tabular text-[13px] text-muted">
          {formatDuration(elapsedSeconds(workout.started_at, now), 'clock')}
          {p.planned > 0 && ` · ${p.done}/${p.planned} set`}
        </div>
      </div>
      <Icon name="chevronRight" size={20} className="text-accent" />
    </button>
  )
}

function TemplateCard({ template, onStart, starting, disabled }: {
  template: Template; onStart: () => void; starting: boolean; disabled: boolean
}) {
  const names = template.items.map((i) => i.exercise?.name).filter(Boolean)
  const count = template.items.length
  const editTo = `/traning/mallar/${template.id}`
  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-card)] border border-line/70 bg-surface py-2 pl-4 pr-2 transition-colors hover:border-line-strong">
      <Link to={editTo} className="min-w-0 flex-1 py-2">
        <div className="truncate text-[17px] font-semibold">{template.name}</div>
        <div className="mt-0.5 truncate text-[13px] text-muted">
          {count === 1 ? '1 övning' : `${count} övningar`}
          {names.length > 0 && <span className="text-faint"> · {names.join(', ')}</span>}
        </div>
      </Link>
      <Link to={editTo} aria-label={`Redigera ${template.name}`} title="Redigera"
        className="grid size-11 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-raised hover:text-fg">
        <Icon name="edit" size={20} />
      </Link>
      <button type="button" onClick={onStart} disabled={disabled}
        aria-label={`Starta ${template.name}`} title="Starta"
        className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_8px_24px_-14px_rgb(200_241_105/0.7)] transition-transform duration-150 active:scale-90 disabled:opacity-40">
        {starting ? <Spinner size={20} /> : <Icon name="play" size={22} />}
      </button>
    </div>
  )
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laddar">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-[var(--radius-card)]" />)}
    </div>
  )
}
