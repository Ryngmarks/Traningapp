import { CATEGORY_LABEL } from '@/domain/format'
import { EXERCISE_CATEGORIES } from '@/domain/types'
import { cn } from '@/ui/cn'
import type { CategoryFilter } from '../exerciseList'

const OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Alla' },
  ...EXERCISE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
]

/** Single-select category filter on one horizontally scrolling row. */
export function CategoryChips({ value, onChange, className }: {
  value: CategoryFilter; onChange: (v: CategoryFilter) => void; className?: string
}) {
  return (
    <div role="radiogroup" aria-label="Kategori" className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)}>
      {OPTIONS.map((o) => {
        const active = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
            className={cn(
              'h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors',
              active ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line bg-sunken text-muted hover:text-fg',
            )}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
