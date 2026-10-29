import { describe, expect, it } from 'vitest'
import { guessCategory, guessMeasurement } from './exerciseGuess'

describe('guessCategory', () => {
  it.each([
    ['Hackbenböj', 'legs'], ['Hack squat', 'legs'], ['Benpress enbens', 'legs'], ['Stående vadpress', 'legs'],
    ['Liggande lårcurl', 'hamstrings'], ['Marklyft sumo', 'hamstrings'], ['Hip thrust maskin', 'hamstrings'],
    ['Lutande bänkpress', 'chest'], ['Pec deck', 'chest'], ['Flyes i maskin', 'chest'],
    ['Latsdrag smalt grepp', 'back'], ['T-bar rodd', 'back'], ['Chins med vikt', 'back'],
    ['Axelpress maskin', 'shoulders'], ['Sidolyft kabel', 'shoulders'], ['Face pull rep', 'shoulders'],
    ['Bicepscurl kabel', 'arms'], ['Triceps overhead', 'arms'], ['EZ-curl', 'arms'],
    ['Planka på boll', 'core'], ['Kabelcrunch', 'core'], ['Hängande benlyft', 'core'],
    ['Adduktormaskin', 'hip_groin'], ['Copenhagen kort hävstång', 'hip_groin'],
    ['Djuphopp', 'explosive'], ['Medicinbollskast', 'explosive'],
    ['Höftböjarstretch', 'mobility'],
    ['Löpband backe', 'conditioning'], ['Spinningcykel', 'conditioning'],
  ])('%s → %s', (name, expected) => {
    expect(guessCategory(name)).toBe(expected)
  })

  it('returns null for unknown or too short names', () => {
    expect(guessCategory('Xy')).toBeNull()
    expect(guessCategory('Min specialövning')).toBeNull()
  })
})

describe('guessMeasurement', () => {
  it.each([
    ['Löpband backe', 'cardio'], ['Crosstrainer intervaller', 'cardio'],
    ['Planka på boll', 'duration'], ['Dödhäng', 'duration'],
    ['Armhävningar breda', 'bodyweight_reps'], ['Chins', 'bodyweight_reps'], ['Hängande benlyft', 'bodyweight_reps'],
    ['Kabelcrunch', 'weight_reps'], ['Dips med vikt', 'weight_reps'], ['Hackbenböj', 'weight_reps'],
  ])('%s → %s', (name, expected) => {
    expect(guessMeasurement(name)).toBe(expected)
  })
})
