import { formatCardio, formatDistance, formatDuration, formatRelativeDay } from '@/domain/format'
import type { ProgressionSuggestion } from '@/domain/progression'
import type { MeasurementType, SetValues } from '@/domain/types'
import type { LastPerformanceRow, PerformedExercise } from '@/data/workout'

// Short Swedish texts for the active workout screen.

const nfInput = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, useGrouping: false })
const nfKg = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 })

/** 62.5 → "62,5" (no unit, no grouping): for inputs. */
export const formatInputNumber = (n: number | null) => (n == null ? '' : nfInput.format(n))
export const formatKg = (n: number) => `${nfKg.format(n)} kg`

/** "3 × 8–12 · 2 uppv." */
export function planText(e: PerformedExercise): string {
  const working = e.planned_sets ?? e.sets.filter((s) => s.kind === 'working').length
  const warmups = e.sets.filter((s) => s.kind === 'warmup').length
  const reps = e.rep_min != null && e.rep_max != null
    ? (e.rep_min === e.rep_max ? `${e.rep_min}` : `${e.rep_min}–${e.rep_max}`)
    : e.rep_min != null ? `${e.rep_min}` : e.rep_max != null ? `${e.rep_max}` : null
  const isReps = e.measurement_type === 'weight_reps' || e.measurement_type === 'bodyweight_reps'
  const main = reps && isReps ? `${working} × ${reps}` : `${working} set`
  return warmups > 0 ? `${main} · ${warmups} uppv.` : main
}

/** "60 kg × 12, 12, 11" (grouped by load). */
export function setsText(sets: readonly SetValues[], m: MeasurementType): string {
  const work = sets.filter((s) => s.kind === 'working')
  const list = work.length > 0 ? work : sets
  if (list.length === 0) return ''
  switch (m) {
    case 'duration':
      return list.map((s) => formatDuration(s.duration_s)).join(', ')
    case 'distance':
      return list.map((s) => formatDistance(s.distance_m)).join(', ')
    case 'cardio':
      return list.map(formatCardio).join(' / ')
    case 'bodyweight_reps':
    case 'weight_reps': {
      const groups: { kg: number | null; reps: (number | null)[] }[] = []
      for (const s of list) {
        const last = groups[groups.length - 1]
        if (last && last.kg === s.weight_kg) last.reps.push(s.reps)
        else groups.push({ kg: s.weight_kg, reps: [s.reps] })
      }
      return groups.map((g) => {
        const reps = g.reps.map((r) => r ?? '–').join(', ')
        if (g.kg == null || g.kg === 0) return m === 'bodyweight_reps' ? `${reps} reps` : reps
        return m === 'bodyweight_reps' ? `+${formatKg(g.kg)} × ${reps}` : `${formatKg(g.kg)} × ${reps}`
      }).join(' / ')
    }
  }
}

const localDateFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
/** ISO instant → device-local YYYY-MM-DD. */
export const localDateOf = (iso: string) => localDateFmt.format(new Date(iso))

export function lastText(last: LastPerformanceRow, m: MeasurementType, today: string): string {
  const sets = setsText(last.sets, m)
  return `${sets} · ${formatRelativeDay(localDateOf(last.started_at), today)}`
}

export function suggestionText(s: ProgressionSuggestion): string | null {
  switch (s.kind) {
    case 'increase_weight': return `${formatKg(s.toKg)} × ${s.reps}`
    case 'add_reps': return `${s.targetReps} reps`
    case 'hold': return null
  }
}
