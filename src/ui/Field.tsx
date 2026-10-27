import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-[var(--radius-control)] border border-line bg-sunken px-3.5 text-fg placeholder:text-faint transition-colors focus:border-accent/70 focus:outline-none disabled:opacity-50'

export function Field({ label, error, hint, children, id }: {
  label: string; error?: string | null; hint?: ReactNode; children: (id: string) => ReactNode; id?: string
}) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="space-y-1.5">
      <label htmlFor={fid} className="block px-0.5 text-[13px] font-medium text-muted">{label}</label>
      {children(fid)}
      {error ? <p role="alert" className="px-0.5 text-[13px] text-danger">{error}</p>
        : hint ? <p className="px-0.5 text-[12px] text-faint">{hint}</p> : null}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cn(control, 'h-12', invalid && 'border-danger/70', className)} aria-invalid={invalid || undefined} {...rest} />
  },
)

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 py-3', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa3ae' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}>
      {children}
    </select>
  )
}

/** Choice chips: large, thumb-friendly single select. */
export function ChipGroup<T extends string | number>({ value, onChange, options, label, className }: {
  value: T | null; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; label: string; className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cn(
            'h-10 rounded-full border px-4 text-[14px] font-medium transition-colors',
            o.value === value ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line bg-sunken text-muted hover:text-fg',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
