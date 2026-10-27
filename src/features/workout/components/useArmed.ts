import { useCallback, useEffect, useState } from 'react'

/**
 * Two-tap confirmation for destructive actions without a modal: the first tap
 * arms the button, a second tap within `timeoutMs` performs the action.
 */
export function useArmed(timeoutMs = 4000) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), timeoutMs)
    return () => clearTimeout(t)
  }, [armed, timeoutMs])
  const arm = useCallback(() => setArmed(true), [])
  const reset = useCallback(() => setArmed(false), [])
  return { armed, arm, reset }
}
