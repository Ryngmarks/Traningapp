import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { IconButton } from './Button'

/**
 * Bottom sheet for pickers and short forms. Use sparingly: prefer inline UI.
 * Closes on backdrop tap, Escape and the close button; focus moves into it.
 */
export function Sheet({ open, onClose, title, children, footer, className }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[28px] border border-line bg-surface shadow-2xl outline-none animate-slide-up sm:rounded-[28px]',
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <IconButton icon="x" label="Stäng" size={36} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-safe pt-3"><div className="pb-3">{footer}</div></div>}
      </div>
    </div>,
    document.body,
  )
}
