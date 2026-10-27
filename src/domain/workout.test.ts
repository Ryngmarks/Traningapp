import { describe, expect, it } from 'vitest'
import { currentExerciseId, isSetReady, nextSetValues, workoutProgress, type WorkoutExercise, type WorkoutSet } from './workout'

const set = (position: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${position}`, position, kind: 'working', weight_kg: 60, reps: 8, duration_s: null, distance_m: null, completed_at: null, ...extra,
})

const exercises: WorkoutExercise[] = [
  { id: 'e1', position: 0, measurement_type: 'weight_reps', sets: [set(0, { kind: 'warmup', completed_at: 'x' }), set(1, { completed_at: 'x' }), set(2, { completed_at: 'x' })] },
  { id: 'e2', position: 1, measurement_type: 'weight_reps', sets: [set(0), set(1)] },
]

describe('workout helpers', () => {
  it('measures progress on working sets only', () => {
    expect(workoutProgress(exercises)).toEqual({ done: 2, planned: 4, ratio: 0.5 })
    expect(workoutProgress([])).toEqual({ done: 0, planned: 0, ratio: 0 })
  })

  it('finds the first exercise with work left', () => {
    expect(currentExerciseId(exercises)).toBe('e2')
  })

  it('requires the values each measurement needs', () => {
    expect(isSetReady({ weight_kg: 60, reps: 8, duration_s: null, distance_m: null }, 'weight_reps')).toBe(true)
    expect(isSetReady({ weight_kg: null, reps: 8, duration_s: null, distance_m: null }, 'weight_reps')).toBe(false)
    expect(isSetReady({ weight_kg: null, reps: 8, duration_s: null, distance_m: null }, 'bodyweight_reps')).toBe(true)
    expect(isSetReady({ weight_kg: null, reps: null, duration_s: 30, distance_m: null }, 'duration')).toBe(true)
    expect(isSetReady({ weight_kg: null, reps: null, duration_s: null, distance_m: 0 }, 'distance')).toBe(false)
  })

  it('copies the previous set of the same kind for a new set', () => {
    expect(nextSetValues(exercises[0]!.sets)).toMatchObject({ position: 3, kind: 'working', weight_kg: 60, reps: 8 })
    expect(nextSetValues([])).toMatchObject({ position: 0, weight_kg: null })
  })
})
