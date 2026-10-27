import { cn } from './cn'

export function SegmentedControl<T extends string>({ value, onChange, options, className, label }: {
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: string }[]
  className?: string
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-2xl bg-sunken p-1 ring-1 ring-line/60', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 flex-1 rounded-xl px-2 text-[14px] font-semibold transition-all duration-200',
              active ? 'bg-raised text-fg shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
