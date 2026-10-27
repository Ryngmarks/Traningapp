import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * Go back in history, or to `fallback` when the screen was opened directly
 * (deep link, home-screen launch): a PWA has no browser back button, so a
 * back action must always lead somewhere.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key === 'default') navigate(fallback, { replace: true })
    else navigate(-1)
  }, [fallback, location.key, navigate])
}
