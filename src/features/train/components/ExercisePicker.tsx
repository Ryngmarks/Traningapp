import { useMemo, useState } from 'react'
import { CATEGORY_LABEL, MEASUREMENT_LABEL } from '@/domain/format'
import { type Exercise, isCustomExercise, useExercises } from '@/data/exercises'
import { Button } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import { Sheet } from '@/ui/Sheet'
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States'
import { type CategoryFilter, groupExercises } from '../exerciseList'
import { CategoryChips } from './CategoryChips'
import { SearchInput } from './SearchInput'

/**
 * Bottom sheet for choosing an exercise. In `multi` mode it stays open so
 * several exercises can be added in a row; `pickedCount` is shown in "Klar".
 */
export function ExercisePicker({ open, onClose, onPick, title = 'Välj övning', multi = false, pickedIds }: {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  title?: string
  multi?: boolean
  /** Exercises already chosen (shown with a check). */
  pickedIds?: ReadonlySet<string>
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} className="h-[88dvh]"
      footer={multi ? <Button variant="primary" block size="lg" onClick={onClose}>Klar</Button> : undefined}>
      {open && <PickerBody onPick={(e) => { onPick(e); if (!multi) onClose() }} pickedIds={pickedIds} />}
    </Sheet>
  )
}

function PickerBody({ onPick, pickedIds }: { onPick: (e: Exercise) => void; pickedIds?: ReadonlySet<string> }) {
  const { data, isPending, error, refetch } = useExercises()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const groups = useMemo(() => groupExercises(data ?? [], query, category), [data, query, category])

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 space-y-3 bg-surface px-5 pb-3">
        <SearchInput value={query} onChange={setQuery} />
        <CategoryChips value={category} onChange={setCategory} className="-mx-5 px-5" />
      </div>
      {isPending ? <ListSkeleton rows={6} />
        : error ? <ErrorState error={error} onRetry={() => void refetch()} />
        : groups.length === 0 ? <EmptyState icon="search" title="Inga träffar" text="Prova ett annat sökord eller en annan kategori." />
        : groups.map((g) => (
          <section key={g.category} className="mt-3 first:mt-1">
            {category === 'all' && <h3 className="px-1 pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{g.label}</h3>}
            <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line/70 bg-sunken/40">
              {g.items.map((e) => {
                const picked = pickedIds?.has(e.id) ?? false
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => onPick(e)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-raised">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{e.name}</span>
                        <span className="block truncate text-[12px] text-faint">
                          {category === 'all' ? CATEGORY_LABEL[e.category] : MEASUREMENT_LABEL[e.measurement_type]}
                          {isCustomExercise(e) && ' · Egen'}
                        </span>
                      </span>
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full',
                        picked ? 'bg-accent text-on-accent animate-pop' : 'text-faint')}>
                        <Icon name={picked ? 'check' : 'plus'} size={18} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </div>
  )
}
