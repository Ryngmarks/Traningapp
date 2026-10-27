import type { ActivityType } from '@/domain/types'
import { ACTIVITY_COLOR } from '../Badge'
import type { ChartSeries } from './parts'

/**
 * Chart series for activity types. Football training and matches share one
 * series (and one colour). The order is fixed and validated for colour-vision
 * separation between neighbours: gym, football, run, walk, other.
 */
export const ACTIVITY_SERIES: readonly ChartSeries[] = [
  { key: 'gym', label: 'Gym', color: ACTIVITY_COLOR.gym },
  { key: 'football', label: 'Fotboll', color: ACTIVITY_COLOR.football_training },
  { key: 'run', label: 'Löpning', color: ACTIVITY_COLOR.run },
  { key: 'walk', label: 'Promenad', color: ACTIVITY_COLOR.walk },
  { key: 'other', label: 'Övrigt', color: ACTIVITY_COLOR.other },
]

/** Map per-type counts to chart series values (football merged). */
export function seriesValues(counts: Record<ActivityType, number>): Record<string, number> {
  return {
    gym: counts.gym,
    football: counts.football_training + counts.football_match,
    run: counts.run,
    walk: counts.walk,
    other: counts.other,
  }
}
