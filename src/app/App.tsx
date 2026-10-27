import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { useSession } from '@/data/auth'
import { queryClient } from '@/data/queryClient'
import { isSupabaseConfigured } from '@/data/supabase'
import { ConfigMissingScreen, LoginScreen } from '@/features/auth/LoginScreen'
import { ToastProvider } from '@/ui/Toast'
import { Spinner } from '@/ui/Spinner'
import { routes } from './routes'

// BASE_URL is '/' on Vercel and '/<repo>/' on GitHub Pages.
const router = createBrowserRouter([...routes, { path: '*', element: <Navigate to="/" replace /> }], {
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

function AuthGate() {
  const session = useSession()
  if (session === undefined) {
    return <div className="grid min-h-dvh place-items-center text-muted"><Spinner size={28} /></div>
  }
  if (!session) return <LoginScreen />
  return <RouterProvider router={router} />
}

export function App() {
  if (!isSupabaseConfigured) return <ConfigMissingScreen />
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthGate />
      </ToastProvider>
    </QueryClientProvider>
  )
}
