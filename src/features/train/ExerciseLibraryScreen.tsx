import { useEffect, useMemo, useState } from 'react'
import { MEASUREMENT_LABEL } from '@/domain/format'
import { useUserId } from '@/data/auth'
import { type Exercise, isCustomExercise, isOwnExercise, useArchiveExercise, useExercises } from '@/data/exercises'
import { useMembers } from '@/data/members'
import { toDataError } from '@/data/errors'
import { Button } from '@/ui/Button'
import { SectionTitle } from '@/ui/Card'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import { Pill } from '@/ui/Badge'
import { Screen, SubHeader } from '@/ui/Page'
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { CategoryChips } from './components/CategoryChips'
import { ExerciseFormSheet } from './components/ExerciseFormSheet'
import { SearchInput } from './components/SearchInput'
import { type CategoryFilter, groupExercises, joinList } from './exerciseList'

export function ExerciseLibraryScreen() {
  const { data, isPending, error, refetch } = useExercises()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<{ exercise?: Exercise } | null>(null)
  const groups = useMemo(() => groupExercises(data ?? [], query, category), [data, query, category])

  return (
    <Screen>
      <SubHeader title="Övningar" back="/traning"
        action={<Button size="sm" icon="plus" className="mr-1" onClick={() => setForm({})}>Ny övning</Button>} />

      <div className="space-y-3 pb-1">
        <SearchInput value={query} onChange={setQuery} />
        <CategoryChips value={category} onChange={setCategory} className="-mx-4 px-4" />
      </div>

      {isPending ? <ListSkeleton rows={6} />
        : error ? <ErrorState error={error} onRetry={() => void refetch()} />
        : groups.length === 0 ? (
          <EmptyState icon="search" title="Inga träffar" text="Hittar du inte övningen? Skapa en egen."
            action={<Button icon="plus" onClick={() => setForm({})}>Ny övning</Button>} />
        ) : groups.map((g) => (
          <section key={g.category}>
            <SectionTitle>{g.label}</SectionTitle>
            <ul className="divide-y divide-line/60 overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface">
              {g.items.map((e) => (
                <li key={e.id}>
                  <ExerciseRow exercise={e} open={expanded === e.id}
                    onToggle={() => setExpanded((x) => (x === e.id ? null : e.id))}
                    onEdit={() => setForm({ exercise: e })} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      <ExerciseFormSheet open={form !== null} onClose={() => setForm(null)} exercise={form?.exercise} />
    </Screen>
  )
}

function ExerciseRow({ exercise: e, open, onToggle, onEdit }: {
  exercise: Exercise; open: boolean; onToggle: () => void; onEdit: () => void
}) {
  const userId = useUserId()
  const members = useMembers()
  const custom = isCustomExercise(e)
  const own = isOwnExercise(e, userId)
  const panelId = `ex-${e.id}`
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-raised">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{e.name}</span>
            {own && <Pill tone="accent" className="h-5 px-2 text-[11px]">Egen</Pill>}
            {custom && !own && <Pill className="h-5 px-2 text-[11px]">{`av ${members.data?.get(e.owner_id!) ?? 'medlem'}`}</Pill>}
          </span>
          <span className="block truncate text-[13px] text-faint">
            {MEASUREMENT_LABEL[e.measurement_type]}{e.equipment.length > 0 && ` · ${joinList(e.equipment)}`}
          </span>
        </span>
        <Icon name="chevronDown" size={18} className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <ExerciseDetails id={panelId} exercise={e} own={own} onEdit={onEdit} />}
    </div>
  )
}

function ExerciseDetails({ id, exercise: e, own, onEdit }: { id: string; exercise: Exercise; own: boolean; onEdit: () => void }) {
  const archive = useArchiveExercise()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 4000)
    return () => clearTimeout(t)
  }, [confirm])

  const onArchive = () => {
    if (!confirm) { setConfirm(true); return }
    archive.mutate(e.id, {
      onSuccess: () => toast('Övningen arkiverad', { tone: 'info' }),
      onError: (err) => { setConfirm(false); toast(toDataError(err).message, { tone: 'error' }) },
    })
  }

  return (
    <div id={id} className="space-y-3 px-4 pb-4 text-[14px] animate-fade-in">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {e.primary_muscles.length > 0 && <Detail term="Primärt" value={joinList(e.primary_muscles)} />}
        {e.secondary_muscles.length > 0 && <Detail term="Sekundärt" value={joinList(e.secondary_muscles)} />}
        {e.equipment.length > 0 && <Detail term="Utrustning" value={joinList(e.equipment)} />}
      </dl>
      {e.instructions && <p className="leading-relaxed text-muted">{e.instructions}</p>}
      {own && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" icon="edit" onClick={onEdit}>Redigera</Button>
          <Button size="sm" icon="archive" variant={confirm ? 'danger' : 'ghost'} loading={archive.isPending} onClick={onArchive}>
            {confirm ? 'Tryck igen för att arkivera' : 'Arkivera'}
          </Button>
        </div>
      )}
    </div>
  )
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-faint">{term}</dt>
      <dd className="text-fg">{value}</dd>
    </>
  )
}
