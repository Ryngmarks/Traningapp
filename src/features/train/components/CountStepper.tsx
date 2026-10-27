import { useId } from 'react'
import { Icon } from '@/ui/Icon'

/** Small integer stepper (set counts) with 44px buttons, no keyboard needed. */
export function CountStepper({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number
}) {
  const id = useId()
  const btn = 'grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-[transform,color] active:scale-90 hover:text-fg disabled:opacity-30'
  return (
    <div>
      <div id={id} className="mb-1.5 px-0.5 text-[13px] font-medium text-muted">{label}</div>
      <div role="group" aria-labelledby={id} className="flex items-center rounded-[var(--radius-control)] border border-line bg-sunken">
        <button type="button" className={btn} aria-label={`Minska ${label.toLowerCase()}`}
          disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          <Icon name="minus" size={18} />
        </button>
        <output aria-live="polite" className="tabular flex-1 text-center text-[17px] font-semibold">{value}</output>
        <button type="button" className={btn} aria-label={`Öka ${label.toLowerCase()}`}
          disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  )
}
