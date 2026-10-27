import { CATEGORY_LABEL } from '@/domain/format'
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '@/domain/types'
import type { Exercise } from '@/data/exercises'

export type CategoryFilter = ExerciseCategory | 'all'

/** Lowercase and strip diacritics so "knaboj" finds "Knäböj". */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

function matches(e: Exercise, q: string): boolean {
  if (!q) return true
  const hay = normalizeSearch([e.name, ...e.primary_muscles, ...e.secondary_muscles, ...e.equipment].join(' '))
  return q.split(/\s+/).every((word) => hay.includes(word))
}

export interface ExerciseGroup {
  category: ExerciseCategory
  label: string
  items: Exercise[]
}

/** Filter by search text and category, grouped in the library's category order. */
export function groupExercises(list: readonly Exercise[], query: string, category: CategoryFilter): ExerciseGroup[] {
  const q = normalizeSearch(query)
  const filtered = list.filter((e) => (category === 'all' || e.category === category) && matches(e, q))
  return EXERCISE_CATEGORIES
    .map((c) => ({ category: c, label: CATEGORY_LABEL[c], items: filtered.filter((e) => e.category === c) }))
    .filter((g) => g.items.length > 0)
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/** "Skivstång, ställning" */
export const joinList = (xs: readonly string[]) => capitalize(xs.join(', '))
