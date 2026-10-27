import { formatDuration } from '@/domain/format'
import { elapsedSeconds, type Progress } from '@/domain/workout'
import { IconButton } from '@/ui/Button'
import { useNow } from '@/ui/useNow'

/** Sticky top bar: minimise, name, running clock and a thin progress line. */
export function WorkoutHeader({ name, startedAt, progress, onMinimize }: {
  name: string; startedAt: string; progress: Progress; onMinimize: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/50 bg-bg/85 pt-safe backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-2">
        <IconButton icon="chevronDown" label="Minimera passet" onClick={onMinimize} />
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-semibold leading-tight">{name}</h1>
          <p className="tabular text-[13px] text-muted">
            <Elapsed startedAt={startedAt} />
            {progress.planned > 0 && <span className="text-faint"> · {progress.done}/{progress.planned} set</span>}
          </p>
        </div>
        <div className="w-11 shrink-0" aria-hidden="true" />
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
