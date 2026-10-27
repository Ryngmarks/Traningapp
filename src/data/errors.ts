// Turns Supabase/Postgres/network errors into short Swedish messages and a
// flag for whether retrying can help.

export class DataError extends Error {
  readonly code: string | undefined
  readonly retryable: boolean
  constructor(message: string, code?: string, retryable = false, cause?: unknown) {
    super(message, { cause })
    this.name = 'DataError'
    this.code = code
    this.retryable = retryable
  }
}

interface PgLikeError { message?: string; code?: string; status?: number }

export function toDataError(e: unknown): DataError {
  if (e instanceof DataError) return e
  const err = (e ?? {}) as PgLikeError
  const msg = err.message ?? ''
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new DataError('Ingen anslutning. Ändringen är inte sparad.', 'offline', true, e)
  }
  if (e instanceof TypeError || /fetch|network|Failed to fetch|Load failed/i.test(msg)) {
    return new DataError('Kunde inte nå servern. Ändringen är inte sparad.', 'network', true, e)
  }
  if (msg.includes('active_workout_exists')) {
    return new DataError('Du har redan ett pågående pass.', 'active_workout_exists', false, e)
  }
  switch (err.code) {
    case '42501': return new DataError('Behörighet saknas. Logga in igen.', err.code, false, e)
    case 'PGRST301': case 'PGRST303': return new DataError('Sessionen har gått ut. Logga in igen.', err.code, false, e)
    case '23505': return new DataError('Finns redan.', err.code, false, e)
    case '23514': case '22023': case '22P02': return new DataError('Ogiltigt värde.', err.code, false, e)
    case 'P0002': return new DataError('Hittades inte.', err.code, false, e)
  }
  if (err.status && err.status >= 500) return new DataError('Serverfel. Försök igen.', String(err.status), true, e)
  return new DataError('Något gick fel. Försök igen.', err.code, true, e)
}

/** Unwrap a Supabase response, throwing a DataError on failure. */
export function unwrap<T>(res: { data: T | null; error: unknown }): NonNullable<T> {
  if (res.error) throw toDataError(res.error)
  return res.data as NonNullable<T>
}

/** Like unwrap, for queries where "no row" is a valid answer (maybeSingle). */
export function unwrapMaybe<T>(res: { data: T | null; error: unknown }): T | null {
  if (res.error) throw toDataError(res.error)
  return res.data
}
