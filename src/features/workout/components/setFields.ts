import type { MeasurementType } from '@/domain/types'
import type { PerformedSet } from '@/data/workout'

export type ValueKey = 'weight_kg' | 'reps' | 'duration_s' | 'distance_m' | 'speed_kmh' | 'incline_pct' | 'calories'

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
  /** Stored value = shown value × scale (minutes → seconds, km → metres). */
  scale?: number
  /** Shown on a second, smaller row (cardio extras). */
  secondary?: boolean
  /** At least one field marked oneOf must have a value (cardio: time or distance). */
  oneOf?: boolean
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
    case 'cardio':
      return [
        { key: 'duration_s', label: 'Min', name: 'Tid i minuter', integer: false, step: 1, max: 1440, scale: 60, required: false, oneOf: true },
        { key: 'distance_m', label: 'Km', name: 'Distans i km', integer: false, step: 0.1, max: 100, scale: 1000, required: false, oneOf: true },
        { key: 'speed_kmh', label: 'km/h', name: 'Hastighet', integer: false, step: 0.5, max: 40, required: false, optional: true, secondary: true },
        { key: 'incline_pct', label: 'Lutning %', name: 'Lutning', integer: false, step: 0.5, max: 40, required: false, optional: true, secondary: true },
        { key: 'calories', label: 'Kcal', name: 'Kalorier', integer: true, step: 10, max: 10_000, required: false, optional: true, secondary: true },
      ]
  }
}

/** Value as shown in the input (e.g. seconds → minutes). */
export function shownValue(stored: number | null | undefined, f: SetField): number | null {
  if (stored == null) return null
  return f.scale ? Math.round((stored / f.scale) * 100) / 100 : stored
}

/** Value to store from what the user typed (e.g. minutes → seconds). */
export function storedValue(shown: number | null, f: SetField): number | null {
  if (shown == null) return null
  return f.scale ? Math.round(shown * f.scale) : shown
}

/** Fields that stop a set from being completed (mirrors isSetReady). */
export function missingFields(s: PerformedSet, fields: readonly SetField[]): ValueKey[] {
  const oneOf = fields.filter((f) => f.oneOf)
  if (oneOf.length > 0 && !oneOf.some((f) => (s[f.key] ?? 0) > 0)) return oneOf.map((f) => f.key)
  return fields.filter((f) => {
    if (!f.required) return false
    const v = s[f.key]
    return v == null || (f.key !== 'weight_kg' && v <= 0)
  }).map((f) => f.key)
}

/** Step a stored value by the field's step in shown units; returns the stored value. */
export function stepValue(value: number | null, f: SetField, dir: -1 | 1): number | null {
  const shown = shownValue(value, f)
  if (shown == null && dir < 0) return null
  const next = Math.round(((shown ?? 0) + dir * f.step) * 100) / 100
  if (next <= 0) return f.optional ? null : 0
  return storedValue(Math.min(f.max, next), f)
}
