import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { toDataError } from './errors'
import { queryClient } from './queryClient'
import { supabase } from './supabase'

/** Current auth session; `undefined` while the stored session is loading. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])
  return session
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (error.status === 400 || error.code === 'invalid_credentials') throw new Error('Fel e-post eller lösenord.')
    if (error.status === 429) throw new Error('För många försök. Vänta en stund.')
    throw toDataError(error)
  }
}

/** Signs out everywhere this session is used and clears all cached data. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
  queryClient.clear()
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/installningar`,
  })
  if (error) throw toDataError(error)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toDataError(error)
}
