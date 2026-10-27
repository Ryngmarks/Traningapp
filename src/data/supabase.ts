import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// The URL and anon/publishable key are public by design and ship in the
// bundle. Data is protected by RLS (docs/SECURITY.md). A service role key
// must never be used in the frontend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Read before supabase-js consumes the URL hash: invite and password-reset
// links sign the user in and must then ask for a (new) password.
const linkType = typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.slice(1)).get('type')
export const openedFromPasswordLink = linkType === 'invite' || linkType === 'recovery'
export const openedFromInvite = linkType === 'invite'

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'not-configured', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'traningsapp-auth',
  },
})
