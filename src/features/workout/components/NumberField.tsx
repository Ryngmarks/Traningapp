import { type Ref, useState } from 'react'
import { parseNumberInput } from '@/domain/validation'
import { cn } from '@/ui/cn'
import { formatInputNumber } from './workoutText'

export interface NumberFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  /** Integers use the numeric keypad; decimals accept "62,5". */
  integer?: boolean
  max: number
  label: string
  placeholder?: string
  invalid?: boolean
  done?: boolean
  className?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Big, centred number input for set values. Keeps the typed text while
 * focused (so "62," survives), commits every valid keystroke, selects all
 * on focus so a new value can be typed straight away.
 */
export function NumberField({ value, onChange, integer, max, label, placeholder, invalid, done, className, ref }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  // Keep the typed text only while it still describes the value; a stepper
  // tap or a progression hint changes the value and must show through.
  const shown = draft != null && draftMatches(draft, value, integer) ? draft : formatInputNumber(value)

  const onText = (text: string) => {
    if (text.trim() === '') { setDraft(text); onChange(null); return }
    const n = parseNumberInput(text)
    // Reject what cannot be a value (letters, negatives, too large): keep the old text.
    if (n == null || n < 0 || n > max) return
    setDraft(text)
    const next = normalize(n, integer)
    if (next !== value) onChange(next)
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      pattern={integer ? '[0-9]*' : undefined}
      autoComplete="off"
      enterKeyHint="done"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      value={shown}
      onChange={(e) => onText(e.target.value)}
      onFocus={(e) => {
        const el = e.currentTarget
        // iOS ignores select() during focus; defer it one frame.
        requestAnimationFrame(() => { if (document.activeElement === el) el.setSelectionRange(0, el.value.length) })
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={cn(
        'tabular h-12 w-full min-w-0 rounded-xl border bg-sunken px-1 text-center text-[18px] font-semibold text-fg transition-colors placeholder:font-medium placeholder:text-faint focus:border-accent/70 focus:outline-none',
        invalid ? 'border-danger/80 bg-danger-soft' : done ? 'border-transparent bg-black/20' : 'border-line',
        className,
      )}
    />
  )
}

const normalize = (n: number, integer: boolean | undefined) => (integer ? Math.round(n) : Math.round(n * 100) / 100)

function draftMatches(draft: string, value: number | null, integer: boolean | undefined): boolean {
  if (draft.trim() === '') return value == null
  const n = parseNumberInput(draft)
  return n != null && value != null && normalize(n, integer) === value
}
