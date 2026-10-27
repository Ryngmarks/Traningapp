import type { MeasurementType } from '@/domain/types'
import type { PerformedSet } from '@/data/workout'

export type ValueKey = 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'

export interface SetField {
  key: ValueKey
  /** Column header. */
  label: string
  /** Accessible name stem, e.g. "Vikt". */
  name: string
  integer: boolean
  step: number
  max: number
  placeholder?: string
  /** Optional value: stepping down to 0 clears it (bodyweight extra load). */
  optional?: boolean
  required: boolean
}

const reps: SetField = { key: 'reps', label: 'Reps', name: 'Reps', integer: true, step: 1, max: 1000, required: true }

/** The inputs a set needs for a measurement type (weight step from the profile). */
export function setFields(m: MeasurementType, weightStep: number): SetField[] {
  switch (m) {
    case 'weight_reps':
      return [{ key: 'weight_kg', label: 'kg', name: 'Vikt', integer: false, step: weightStep, max: 1000, required: true }, reps]
    case 'bodyweight_reps':
      return [{ key: 'weight_kg', label: '+kg', name: 'Extra vikt', integer: false, step: weightStep, max: 1000, placeholder: '0', optional: true, required: false }, reps]
    case 'duration':
      return [{ key: 'duration_s', label: 'Sekunder', name: 'Tid i sekunder', integer: true, step: 5, max: 86_400, required: true }]
    case 'distance':
      return [{ key: 'distance_m', label: 'Meter', name: 'Distans i meter', integer: true, step: 5, max: 100_000, required: true }]
  }
}

/** Fields that stop a set from being completed (mirrors isSetReady). */
export function missingFields(s: PerformedSet, fields: readonly SetField[]): ValueKey[] {
  return fields.filter((f) => {
    if (!f.required) return false
    const v = s[f.key]
    return v == null || (f.key !== 'weight_kg' && v <= 0)
  }).map((f) => f.key)
}

export function stepValue(value: number | null, f: SetField, dir: -1 | 1): number | null {
  if (value == null && dir < 0) return null
  const next = Math.round(((value ?? 0) + dir * f.step) * 100) / 100
  if (next <= 0) return f.optional ? null : 0
  return Math.min(f.max, next)
}
