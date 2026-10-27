import { useEffect, useState } from 'react'

/** Current time in ms, refreshed every `intervalMs` (null = don't tick). */
export function useNow(intervalMs: number | null = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (intervalMs == null) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Today's date in the device timezone as YYYY-MM-DD. */
export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
