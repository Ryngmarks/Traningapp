import type { ReactNode } from 'react'
import { IconButton } from './Button'
import { cn } from './cn'
import { useGoBack } from './useGoBack'

/** Top-level screen title (tab roots). */
export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pb-5 pt-2">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-medium text-muted">{subtitle}</p>}
        <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.03em]">{title}</h1>
      </div>
      {action}
    </header>
  )
}

/**
 * Header for pushed screens with a back button. Goes back in history when
 * there is any, otherwise to `back` (the parent screen), defaulting to `/`.
 */
export function SubHeader({ title, back = '/', action, className }: { title: string; back?: string; action?: ReactNode; className?: string }) {
  const goBack = useGoBack(back)
  return (
    <header className={cn('sticky top-0 z-20 -mx-4 mb-3 flex h-14 items-center gap-1 bg-bg/85 px-2 pt-safe backdrop-blur-xl', className)}>
      <IconButton icon="chevronLeft" label="Tillbaka" onClick={goBack} />
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
      {action}
    </header>
  )
}

/** Standard page padding and width; leaves room for the tab bar. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-2xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-safe animate-fade-in', className)}>{children}</div>
}
