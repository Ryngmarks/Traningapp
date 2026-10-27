import { formatDuration } from '@/domain/format'
import { elapsedSeconds, type Progress } from '@/domain/workout'
import { IconButton } from '@/ui/Button'
import { cn } from '@/ui/cn'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'
import { useNow } from '@/ui/useNow'

/** Overall save state shown in the header's right slot. */
export type SyncState = 'saved' | 'saving' | 'error' | 'offline'

/** Sticky top bar: back (the workout keeps running), name, clock, sync state and a thin progress line. */
export function WorkoutHeader({ name, startedAt, progress, sync, onBack }: {
  name: string; startedAt: string; progress: Progress; sync: SyncState; onBack: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/50 bg-bg/85 pt-safe backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-2">
        <IconButton icon="chevronLeft" label="Tillbaka till Träna (passet fortsätter)" onClick={onBack} />
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-semibold leading-tight">{name}</h1>
          <p className="tabular text-[13px] text-muted">
            <Elapsed startedAt={startedAt} />
            {progress.planned > 0 && <span className="text-faint"> · {progress.done}/{progress.planned} set</span>}
          </p>
        </div>
        <SyncIndicator state={sync} />
      </div>
      <div className="h-0.5 w-full bg-line/40" role="progressbar" aria-label="Klara set"
        aria-valuemin={0} aria-valuemax={progress.planned} aria-valuenow={progress.done}>
        <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </div>
    </header>
  )
}

/** Isolated so only the clock re-renders every second. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const now = useNow(1000)
  return <time aria-label="Tid">{formatDuration(elapsedSeconds(startedAt, now), 'clock')}</time>
}

const SYNC_LABEL: Record<SyncState, string> = {
  saved: 'Allt sparat',
  saving: 'Sparar…',
  error: 'Något är inte sparat',
  offline: 'Ingen anslutning',
}

/** Quiet, honest save state: never claims "saved" while anything is pending. */
function SyncIndicator({ state }: { state: SyncState }) {
  return (
    <span role="status" aria-label={SYNC_LABEL[state]} title={SYNC_LABEL[state]}
      className={cn('grid size-11 shrink-0 place-items-center transition-colors',
        state === 'error' ? 'text-danger' : state === 'offline' ? 'text-warning' : 'text-faint')}>
      {state === 'saving' ? <span aria-hidden="true"><Spinner size={16} /></span>
        : state === 'saved' ? <Icon name="check" size={16} className="opacity-60" />
        : <Icon name="cloudOff" size={18} />}
    </span>
  )
}
