import { useState } from 'react'
import { CATEGORY_LABEL, MEASUREMENT_LABEL } from '@/domain/format'
import { EXERCISE_CATEGORIES, type ExerciseCategory, MEASUREMENT_TYPES, type MeasurementType } from '@/domain/types'
import { guessCategory, guessMeasurement } from '@/domain/exerciseGuess'
import { exerciseSchema } from '@/domain/validation'
import { useSession } from '@/data/auth'
import { toDataError } from '@/data/errors'
import { type Exercise, useSaveExercise } from '@/data/exercises'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { ChipGroup, Field, Select, TextArea, TextInput } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { Banner } from '@/ui/States'
import { useToast } from '@/ui/Toast'

const MEASUREMENT_OPTIONS = MEASUREMENT_TYPES.map((m) => ({ value: m, label: MEASUREMENT_LABEL[m] }))

const splitList = (s: string) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)

/**
 * Create or edit one of the user's own exercises. A new exercise gets its
 * category and measurement suggested from the name until the user picks one.
 */
export function ExerciseFormSheet({ open, onClose, exercise, initialName, onCreated }: {
  open: boolean
  onClose: () => void
  exercise?: Exercise
  /** Prefill for a new exercise (e.g. the search text in the picker). */
  initialName?: string
  /** Called with the new exercise after it was created. */
  onCreated?: (exercise: Exercise) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Redigera övning' : 'Ny övning'}>
      {open && <ExerciseForm key={exercise?.id ?? 'new'} exercise={exercise} initialName={initialName} onCreated={onCreated} onDone={onClose} />}
    </Sheet>
  )
}

function ExerciseForm({ exercise, initialName, onCreated, onDone }: {
  exercise?: Exercise; initialName?: string; onCreated?: (exercise: Exercise) => void; onDone: () => void
}) {
  const session = useSession()
  const save = useSaveExercise()
  const toast = useToast()
  const startName = exercise?.name ?? initialName?.trim() ?? ''
  const [name, setName] = useState(startName)
  // Until the user chooses, a new exercise follows the suggestion from its name.
  const [categoryChoice, setCategory] = useState<ExerciseCategory | null>(exercise?.category ?? null)
  const [measurementChoice, setMeasurement] = useState<MeasurementType | null>(exercise?.measurement_type ?? null)
  const guessedCategory = exercise ? null : guessCategory(name)
  const category: ExerciseCategory = categoryChoice ?? guessedCategory ?? 'legs'
  const measurement: MeasurementType = measurementChoice ?? (exercise ? null : guessMeasurement(name)) ?? 'weight_reps'
  const [primary, setPrimary] = useState(exercise?.primary_muscles.join(', ') ?? '')
  const [secondary, setSecondary] = useState(exercise?.secondary_muscles.join(', ') ?? '')
  const [equipment, setEquipment] = useState(exercise?.equipment.join(', ') ?? '')
  const [instructions, setInstructions] = useState(exercise?.instructions ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Optional details stay folded away when creating, so name + one tap is enough.
  const [showDetails, setShowDetails] = useState(Boolean(exercise))

  const ownerId = session?.user.id

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = exerciseSchema.safeParse({
      name,
      category,
      measurement_type: measurement,
      primary_muscles: splitList(primary),
      secondary_muscles: splitList(secondary),
      equipment: splitList(equipment),
      instructions: instructions.trim() === '' ? null : instructions,
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? '')
        if (!errs[k]) errs[k] = k === 'name' || k === 'instructions' ? issue.message : 'Kontrollera listan (högst 40 tecken per ord)'
      }
      setErrors(errs)
      return
    }
    if (!ownerId) return
    setErrors({})
    save.mutate({ id: exercise?.id, input: parsed.data, ownerId }, {
      onSuccess: (saved) => {
        toast(exercise ? 'Övningen sparad' : `${saved.name} skapad i ${CATEGORY_LABEL[saved.category]}`)
        onDone()
        if (!exercise) onCreated?.(saved)
      },
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-1" noValidate>
      <Field label="Namn" error={errors.name}>
        {(fid) => <TextInput id={fid} value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          invalid={Boolean(errors.name)} placeholder="T.ex. Nordic hamstring" autoFocus={!exercise} />}
      </Field>
      <Field label="Kategori" hint={categoryChoice == null && guessedCategory ? 'Föreslagen utifrån namnet, ändra om den blev fel' : undefined}>
        {(fid) => (
          <Select id={fid} value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </Select>
        )}
      </Field>
      <div className="space-y-1.5">
        <div className="px-0.5 text-[13px] font-medium text-muted">Mäts i</div>
        <ChipGroup label="Mäts i" value={measurement} onChange={setMeasurement} options={MEASUREMENT_OPTIONS} />
      </div>
      {!showDetails && !errors.primary_muscles && !errors.secondary_muscles && !errors.equipment && !errors.instructions ? (
        <button type="button" onClick={() => setShowDetails(true)}
          className="flex h-11 w-full items-center gap-2 px-0.5 text-[14px] font-medium text-muted hover:text-fg">
          <Icon name="chevronDown" size={18} />Fler detaljer (muskler, utrustning, instruktion)
        </button>
      ) : (<>
      <Field label="Primära muskler" error={errors.primary_muscles} hint="Separera med kommatecken">
        {(fid) => <TextInput id={fid} value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="baksida lår, säte" />}
      </Field>
      <Field label="Sekundära muskler" error={errors.secondary_muscles}>
        {(fid) => <TextInput id={fid} value={secondary} onChange={(e) => setSecondary(e.target.value)} />}
      </Field>
      <Field label="Utrustning" error={errors.equipment}>
        {(fid) => <TextInput id={fid} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="hantlar, bänk" />}
      </Field>
      <Field label="Instruktioner" error={errors.instructions}>
        {(fid) => <TextArea id={fid} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} />}
      </Field>
      </>)}
      {save.error && <Banner tone="danger">{toDataError(save.error).message}</Banner>}
      <Button type="submit" variant="primary" size="lg" block loading={save.isPending} disabled={!ownerId}>
        {exercise ? 'Spara' : 'Skapa övning'}
      </Button>
    </form>
  )
}
