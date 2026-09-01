/**
 * Helpers para operaciones de autenticación con timeout determinista y desmonte seguro.
 * Garantiza que ninguna promesa pendiente deje la interfaz de usuario colgada indefinidamente.
 * La Veinte Digital
 */

import type { User, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

export interface GetUserResult {
  user: User | null
  timedOut: boolean
  error?: unknown
}

export interface AbortSignalLike {
  aborted?: boolean
}

/**
 * Obtiene el usuario autenticado con timeout garantizado y protección contra desmonte.
 * Si la llamada a Supabase excede `timeoutMs` o la señal se aborta, resuelve de inmediato
 * permitiendo a los componentes limpiar estados de carga.
 */
export async function getUserWithTimeout(
  client: SupabaseClient<Database> | { auth: { getUser: () => Promise<{ data: { user: User | null }; error: unknown }> } },
  timeoutMs = 4000,
  signal?: AbortSignalLike
): Promise<GetUserResult> {
  let timer: NodeJS.Timeout | null = null

  const timeoutPromise = new Promise<GetUserResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({ user: null, timedOut: true })
    }, timeoutMs)
  })

  const authPromise = client.auth
    .getUser()
    .then(({ data, error }) => {
      if (timer) clearTimeout(timer)
      if (signal?.aborted) {
        return { user: null, timedOut: false }
      }
      if (error || !data?.user) {
        return { user: null, timedOut: false, error }
      }
      return { user: data.user, timedOut: false }
    })
    .catch((err) => {
      if (timer) clearTimeout(timer)
      return { user: null, timedOut: false, error: err }
    })

  return Promise.race([authPromise, timeoutPromise])
}
