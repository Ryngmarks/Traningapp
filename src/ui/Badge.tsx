import type { ActivityType } from '@/domain/types'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

export const ACTIVITY_ICON: Record<ActivityType, IconName> = {
  gym: 'dumbbell', football_training: 'ball', football_match: 'ball', walk: 'walk', run: 'run', other: 'activity',
}

/** CSS colour token for an activity type (charts and badges). */
export const ACTIVITY_COLOR: Record<ActivityType, string> = {
  gym: 'var(--color-act-gym)',
  football_training: 'var(--color-act-football)',
  football_match: 'var(--color-act-football)',
  walk: 'var(--color-act-walk)',
  run: 'var(--color-act-run)',
  other: 'var(--color-act-other)',
}

export function ActivityIcon({ type, size = 40, className }: { type: ActivityType; size?: number; className?: string }) {
  return (
    <div className={cn('grid shrink-0 place-items-center rounded-2xl', className)}
      style={{ width: size, height: size, color: ACTIVITY_COLOR[type], background: `color-mix(in srgb, ${ACTIVITY_COLOR[type]} 13%, transparent)` }}>
      <Icon name={ACTIVITY_ICON[type]} size={Math.round(size * 0.5)} />
    </div>
  )
}

export function Pill({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'warning'; className?: string }) {
  const tones = { neutral: 'bg-raised text-muted', accent: 'bg-accent-soft text-accent', warning: 'bg-warning-soft text-warning' }
  return <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold', tones[tone], className)}>{children}</span>
}
