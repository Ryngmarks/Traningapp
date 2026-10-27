import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { cn } from './cn'
import { Icon } from './Icon'

interface Toast { id: number; message: string; tone: 'success' | 'error' | 'info'; action?: { label: string; onClick: () => void } }
type ShowToast = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action']; durationMs?: number }) => void

const Ctx = createContext<ShowToast>(() => {})

/** Short, non-blocking feedback (e.g. "Sparat", with an optional "Ångra"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<ShowToast>((message, opts = {}) => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? 'success', action: opts.action }])
    setTimeout(() => dismiss(id), opts.durationMs ?? (opts.action ? 5000 : 2600))
  }, [dismiss])
  const value = useMemo(() => show, [show])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            'pointer-events-auto flex min-h-11 w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-2.5 text-[14px] font-medium shadow-xl backdrop-blur-md animate-slide-up',
            t.tone === 'error' ? 'border-danger/30 bg-[#2a1517]/95 text-danger' : 'border-line bg-raised/95 text-fg',
          )}>
            <Icon name={t.tone === 'error' ? 'cloudOff' : t.tone === 'success' ? 'check' : 'info'} size={18}
              className={t.tone === 'success' ? 'text-accent' : undefined} />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button type="button" className="-mr-1 rounded-lg px-2 py-1 font-semibold text-accent"
                onClick={() => { t.action!.onClick(); dismiss(t.id) }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
