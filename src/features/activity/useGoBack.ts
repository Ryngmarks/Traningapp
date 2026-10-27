import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Go back in history, or to `fallback` when the screen was opened directly. */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key === 'default') navigate(fallback, { replace: true })
    else navigate(-1)
  }, [fallback, location.key, navigate])
}
