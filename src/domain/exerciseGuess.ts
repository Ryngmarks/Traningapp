import type { ExerciseCategory, MeasurementType } from './types'

/**
 * Suggest a category and measurement type from an exercise name, so a new
 * exercise lands in the right place without the user picking from lists.
 * Swedish and common English gym names. Rules are checked in order: more
 * specific patterns (e.g. "lårcurl", "axelpress") come before generic ones
 * ("curl", "press"). Returns null when nothing matches.
 */
const CATEGORY_RULES: readonly [RegExp, ExerciseCategory][] = [
  [/löpband|treadmill|crosstrainer|cross trainer|motionscykel|cykel|spinning|roddmaskin|rowing|stairmaster|trappmaskin|skierg|airbike|assault|ellipsmaskin|intervall|sprint|löpning|burpee/, 'conditioning'],
  [/stretch|rörlighet|mobility|yoga|foam ?roll|90\/90/, 'mobility'],
  [/triceps|biceps|hammer ?curl|skull|fransk press|french press|underarm|forearm|wrist/, 'arms'],
  [/lårcurl|leg curl|nordic|hamstring|baksida|rumänsk|\brdl\b|marklyft|deadlift|good ?morning|höftlyft|hip thrust|glute|säte|rumpa|kickback|bridge|bäckenlyft/, 'hamstrings'],
  [/adduk|adduct|abduk|abduct|ljumsk|copenhagen|köpenhamn|höftböj|hip flexor|sidogång|band walk/, 'hip_groin'],
  [/hopp|jump|bound|kast|throw|slam|frivänd|\bclean\b|snatch|ryck|plyo/, 'explosive'],
  [/planka|plank|crunch|sit-?up|bål|pallof|russian twist|dead ?bug|hollow|knälyft|benlyft|leg raise|rollout|magrulle|ab ?wheel|\bmage\b|\bcore\b/, 'core'],
  [/knäböj|squat|benpress|leg press|utfall|lunge|step-?up|benspark|leg extension|vadpress|vadlyft|\bvad\b|calf|hack|split ?squat|goblet|\bben\b/, 'legs'],
  [/axel|shoulder|militär|overhead|sidolyft|lateral raise|front ?raise|framåtlyft|face ?pull|omvända|reverse fly|arnold|upright/, 'shoulders'],
  [/rodd|\brow\b|lats|pulldown|pull-?up|chins|rygg|\bback\b|shrug|pullover|ryggres|hyperext/, 'back'],
  [/bänk|bench|bröst|chest|flyes?|\bfly\b|\bpec|armhäv|push-?up|dips|press/, 'chest'],
  [/curl/, 'arms'],
]

const CARDIO = /löpband|treadmill|crosstrainer|cross trainer|motionscykel|cykel|spinning|roddmaskin|rowing machine|stairmaster|trappmaskin|skierg|airbike|assault|ellipsmaskin/
const DURATION = /planka|plank|\bhåll\b|hold|väggsitt|wall ?sit|dödhäng|dead ?hang|stretch|rörlighet|90\/90/
const BODYWEIGHT = /armhäv|push-?up|chins|pull-?up|dips|burpee|sit-?up|crunch|hopp|jump|bound|kroppsvikt|bodyweight|nordic|knälyft|benlyft|leg raise|dead ?bug|magrulle|ab ?wheel/
const WEIGHTED = /kabel|cable|maskin|machine|hantel|hantlar|skivstång|kettlebell|vikt|viktväst|med vikt/

const norm = (name: string) => name.trim().toLowerCase()

export function guessCategory(name: string): ExerciseCategory | null {
  const n = norm(name)
  if (n.length < 3) return null
  return CATEGORY_RULES.find(([re]) => re.test(n))?.[1] ?? null
}

export function guessMeasurement(name: string): MeasurementType | null {
  const n = norm(name)
  if (n.length < 3) return null
  if (CARDIO.test(n)) return 'cardio'
  if (DURATION.test(n)) return 'duration'
  // "Kabelcrunch" or "dips med vikt" are loaded movements.
  if (BODYWEIGHT.test(n) && !WEIGHTED.test(n)) return 'bodyweight_reps'
  return guessCategory(n) ? 'weight_reps' : null
}
