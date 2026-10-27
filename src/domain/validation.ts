import { z } from 'zod'
import { ACTIVITY_TYPES, EXERCISE_CATEGORIES, MEASUREMENT_TYPES } from './types'

// Input validation for everything the user types or imports. The database
// enforces the same limits with CHECK constraints; this layer gives fast,
// friendly Swedish error messages before a request is sent.

const optionalInt = (min: number, max: number, msg: string) =>
  z.number({ error: msg }).int(msg).min(min, msg).max(max, msg).nullable()

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Ange ett namn').max(80, 'Högst 80 tecken'),
  category: z.enum(EXERCISE_CATEGORIES),
  measurement_type: z.enum(MEASUREMENT_TYPES),
  primary_muscles: z.array(z.string().trim().min(1).max(40)).max(12),
  secondary_muscles: z.array(z.string().trim().min(1).max(40)).max(12),
  equipment: z.array(z.string().trim().min(1).max(40)).max(8),
  instructions: z.string().trim().max(1000, 'Högst 1000 tecken').nullable(),
})
export type ExerciseInput = z.infer<typeof exerciseSchema>

export const templateItemSchema = z.object({
  id: z.uuid().optional(),
  exercise_id: z.uuid(),
  warmup_sets: z.number().int().min(0).max(10),
  planned_sets: z.number().int().min(1, 'Minst 1 set').max(20),
  rep_min: optionalInt(1, 100, 'Reps 1–100'),
  rep_max: optionalInt(1, 100, 'Reps 1–100'),
  target_duration_s: optionalInt(1, 86_400, 'Ogiltig tid'),
  target_distance_m: optionalInt(1, 100_000, 'Ogiltig distans'),
  rest_seconds: optionalInt(0, 900, 'Vila 0–900 s'),
  notes: z.string().max(500).nullable(),
}).refine((i) => i.rep_min == null || i.rep_max == null || i.rep_min <= i.rep_max, {
  message: 'Min-reps får inte vara större än max-reps',
  path: ['rep_max'],
})

export const templateSchema = z.object({
  name: z.string().trim().min(1, 'Ge passet ett namn').max(80, 'Högst 80 tecken'),
  notes: z.string().trim().max(1000).nullable(),
  items: z.array(templateItemSchema).max(40, 'Högst 40 övningar'),
})
export type TemplateInput = z.infer<typeof templateSchema>

export const setValuesSchema = z.object({
  weight_kg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  duration_s: z.number().int().min(0).max(86_400).nullable(),
  distance_m: z.number().int().min(0).max(100_000).nullable(),
})

export const activityInputSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  started_at: z.iso.datetime({ offset: true, error: 'Ogiltigt datum' }),
  timezone: z.string().min(1).max(64),
  duration_s: optionalInt(0, 86_400, 'Varaktighet 0–24 h'),
  perceived_exertion: optionalInt(1, 10, 'Ansträngning 1–10'),
  title: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(2000, 'Högst 2000 tecken').nullable(),
  distance_m: optionalInt(0, 1_000_000, 'Ogiltig distans'),
  steps: optionalInt(0, 200_000, 'Ogiltigt stegantal'),
  avg_heart_rate: optionalInt(25, 250, 'Puls 25–250'),
  max_heart_rate: optionalInt(25, 250, 'Puls 25–250'),
})
export type ActivityInput = z.infer<typeof activityInputSchema>

export const historicalTotalSchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  session_count: z.number({ error: 'Ange antal' }).int().min(0).max(100_000),
  total_distance_m: optionalInt(0, 100_000_000, 'Ogiltig distans'),
  total_duration_s: optionalInt(0, 1_000_000_000, 'Ogiltig tid'),
  period_start: z.iso.date().nullable(),
  covers_until: z.iso.date({ error: 'Ange ett datum' }),
  source_label: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(1000).nullable(),
}).refine((t) => t.period_start == null || t.period_start <= t.covers_until, {
  message: 'Startdatum måste vara före slutdatum',
  path: ['period_start'],
})
export type HistoricalTotalInput = z.infer<typeof historicalTotalSchema>

/** Parse a user-typed Swedish number ("62,5") into a number or null. */
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
