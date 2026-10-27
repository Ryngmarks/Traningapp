import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

export function EmptyState({ icon = 'sparkle', title, text, action, className }: {
  icon?: IconName; title: string; text?: ReactNode; action?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center animate-fade-in', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-raised text-muted ring-1 ring-line">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'Något gick fel.'
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-10 text-center animate-fade-in', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Icon name="cloudOff" size={26} />
      </div>
      <h3 className="text-[17px] font-semibold">Kunde inte hämta data</h3>
      <p className="mt-1.5 max-w-xs text-[14px] text-muted">{message}</p>
      {onRetry && <Button className="mt-5" icon="undo" onClick={onRetry}>Försök igen</Button>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-raised/80', className)} />
}

/** Standard skeleton for a list screen. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laddar">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-[72px] rounded-[var(--radius-card)]" />)}
    </div>
  )
}

export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode; action?: ReactNode }) {
  const tones = {
    info: 'bg-raised text-fg ring-line',
    warning: 'bg-warning-soft text-warning ring-warning/25',
    danger: 'bg-danger-soft text-danger ring-danger/25',
  }
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] ring-1', tones[tone])}>
      <Icon name={tone === 'info' ? 'info' : 'cloudOff'} size={18} className="shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}
