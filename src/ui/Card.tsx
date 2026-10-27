import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'
import { Icon } from './Icon'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line/70 bg-surface p-4', className)} {...rest}>
      {children}
    </div>
  )
}

/** Card that navigates; whole surface is the tap target. */
export function LinkCard({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 transition-[transform,border-color] duration-150 active:scale-[0.99] hover:border-line-strong',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <Icon name="chevronRight" size={18} className="text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-baseline justify-between px-1 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {action}
    </div>
  )
}
