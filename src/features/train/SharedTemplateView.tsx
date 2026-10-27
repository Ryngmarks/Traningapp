import { useNavigate } from 'react-router'
import { CATEGORY_LABEL } from '@/domain/format'
import { toDataError } from '@/data/errors'
import { useMembers } from '@/data/members'
import { type Template, useCopyTemplate } from '@/data/templates'
import { Button } from '@/ui/Button'
import { SectionTitle } from '@/ui/Card'
import { Screen, SubHeader } from '@/ui/Page'
import { useToast } from '@/ui/Toast'
import { useStartWorkout } from './useStartWorkout'

/**
 * Read-only view of a template shared by another member or a global starter
 * template. Start it as is, or copy it to your own templates to change it.
 */
export function SharedTemplateView({ template }: { template: Template }) {
  const members = useMembers()
  const starter = useStartWorkout()
  const copy = useCopyTemplate()
  const navigate = useNavigate()
  const toast = useToast()
  const author = template.user_id === null ? 'Förslag från appen' : `Delat av ${members.data?.get(template.user_id) ?? 'en medlem'}`

  const onCopy = () => copy.mutate(template, {
    onSuccess: (id) => {
      toast('Kopierat till dina pass')
      navigate(`/traning/mallar/${id}`, { replace: true })
    },
    onError: (e) => toast(toDataError(e).message, { tone: 'error' }),
  })

  return (
    <Screen>
      <SubHeader title={template.name} back="/traning" />
      <p className="px-1 text-[13px] font-medium text-accent/80">{author}</p>
      {template.notes && <p className="mt-2 px-1 text-[15px] leading-relaxed text-muted">{template.notes}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="primary" size="lg" icon="play" loading={starter.isStarting(template.id)} disabled={starter.isPending}
          onClick={() => starter.start(template.id)}>
          Starta
        </Button>
        <Button size="lg" icon="plus" loading={copy.isPending} onClick={onCopy}>Kopiera</Button>
      </div>

      <SectionTitle>{`Övningar · ${template.items.length}`}</SectionTitle>
      <ol className="-mx-1 divide-y divide-line/60 rounded-[var(--radius-card)] border border-line/70 bg-surface px-4">
        {template.items.map((i, idx) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <span className="tabular w-5 shrink-0 text-[13px] text-faint">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{i.exercise?.name ?? 'Övning'}</div>
              <div className="truncate text-[13px] text-faint">
                {i.exercise ? CATEGORY_LABEL[i.exercise.category] : ''}
              </div>
            </div>
            <span className="tabular shrink-0 text-[14px] text-muted">{planLabel(i)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 px-1 text-[13px] text-faint">Kopiera passet om du vill ändra övningar, set eller reps.</p>
    </Screen>
  )
}

function planLabel(i: Template['items'][number]): string {
  const sets = `${i.planned_sets} ×`
  if (i.rep_min != null && i.rep_max != null) return `${sets} ${i.rep_min === i.rep_max ? i.rep_min : `${i.rep_min}–${i.rep_max}`}`
  if (i.target_duration_s != null) return `${sets} ${i.target_duration_s} s`
  if (i.target_distance_m != null) return `${sets} ${i.target_distance_m} m`
  return `${i.planned_sets} set`
}
