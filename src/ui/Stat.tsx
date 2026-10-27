import type { ReactNode } from 'react'
import { cn } from './cn'

/** Big number with a quiet label. Keep labels to one or two words. */
export function Stat({ label, value, unit, sub, className, accent }: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode; className?: string; accent?: boolean
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className={cn('tabular mt-0.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]', accent ? 'text-accent' : 'text-fg')}>
        {value}
        {unit && <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-[12px] text-faint">{sub}</div>}
    </div>
  )
}
