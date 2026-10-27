import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { formatDuration } from '@/domain/format'
import { elapsedSeconds } from '@/domain/workout'
import { useActiveWorkout } from '@/data/workout'
import { cn } from '@/ui/cn'
import { Icon, type IconName } from '@/ui/Icon'
import { useNow } from '@/ui/useNow'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Översikt', icon: 'home', end: true },
  { to: '/traning', label: 'Träna', icon: 'dumbbell' },
  { to: '/aktivitet', label: 'Aktivitet', icon: 'activity' },
  { to: '/statistik', label: 'Statistik', icon: 'chart' },
]

export function AppShell() {
  const location = useLocation()
  const inWorkout = location.pathname.startsWith('/traning/pass')
  return (
    <div className="min-h-dvh">
      <main><Outlet /></main>
      {!inWorkout && <ActiveWorkoutPill />}
      {!inWorkout && <TabBar />}
    </div>
  )
}

function TabBar() {
  return (
    <nav aria-label="Huvudmeny" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/88 pb-safe backdrop-blur-xl">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.end}
              className={({ isActive }) => cn(
                'flex h-[62px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                isActive ? 'text-fg' : 'text-faint hover:text-muted',
              )}>
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-accent-soft text-accent')}>
                    <Icon name={t.icon} size={21} strokeWidth={isActive ? 2 : 1.75} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Persistent shortcut back to a running workout from any tab. */
function ActiveWorkoutPill() {
  const { data } = useActiveWorkout()
  const now = useNow(data ? 30_000 : null)
  const navigate = useNavigate()
  if (!data) return null
  return (
    <button type="button" onClick={() => navigate('/traning/pass')}
      className="fixed inset-x-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto flex h-12 max-w-md items-center gap-3 rounded-2xl bg-accent px-4 text-on-accent shadow-[0_12px_32px_-12px_rgb(200_241_105/0.7)] animate-slide-up active:scale-[0.98]">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-on-accent/50" />
        <span className="relative inline-flex size-2.5 rounded-full bg-on-accent" />
      </span>
      <span className="flex-1 text-left text-[15px] font-semibold">{data.template_name ?? 'Pågående pass'}</span>
      <span className="tabular text-[14px] font-semibold opacity-80">{formatDuration(elapsedSeconds(data.started_at, now))}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  )
}
