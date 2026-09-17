import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * Estado de acceso de una cuenta suspendida o enviada a papelera.
 *
 * Se evalúa en el servidor (proxy) para cada request protegido. La fila
 * ausente equivale a cuenta activa, de modo que la función es compatible con
 * usuarios anteriores a la migración. Una suspensión temporal vencida vuelve a
 * considerarse activa.
 */

export type AccountAccessCode = "account_suspended" | "account_trashed"

export interface AccountAccessRow {
  status?: string | null
  suspension_kind?: string | null
  suspension_ends_at?: string | null
}

export interface AccountAccessState {
  blocked: boolean
  code: AccountAccessCode | null
  message: string | null
}

export const ACCOUNT_SUSPENDED_MESSAGE =
  "Tu cuenta está temporalmente suspendida. Si crees que es un error, contacta a soporte."

export const ACCOUNT_TRASHED_MESSAGE =
  "Tu cuenta está en proceso de eliminación. Si crees que es un error, contacta a soporte."

export function evaluateAccountAccess(row: AccountAccessRow | null | undefined, now: Date = new Date()): AccountAccessState {
  const status = row?.status ?? "active"

  if (status === "trashed") {
    return { blocked: true, code: "account_trashed", message: ACCOUNT_TRASHED_MESSAGE }
  }

  if (status === "suspended") {
    const kind = row?.suspension_kind ?? null
    const endsAt = row?.suspension_ends_at ?? null
    const stillSuspended =
      kind !== "temporary" || endsAt === null || new Date(endsAt).getTime() > now.getTime()

    if (stillSuspended) {
      return { blocked: true, code: "account_suspended", message: ACCOUNT_SUSPENDED_MESSAGE }
    }
  }

  return { blocked: false, code: null, message: null }
}

/**
 * Consulta el estado propio de la cuenta con el cliente de sesión (RLS de
 * fila propia). Si la consulta falla o lanza (p. ej. migración aún no aplicada
 * en un entorno, o un cliente sin la tabla disponible), se retorna `null` y el
 * llamador deja pasar: la disponibilidad no debe romperse; el baneo de
 * Supabase Auth y las RPC siguen siendo la capa fuerte. Este fail-open está
 * documentado en docs/admin-user-control-center.md.
 */
export async function loadAccountAccessState(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<AccountAccessState | null> {
  try {
    const { data, error } = await client
      .from("user_admin_status")
      .select("status, suspension_kind, suspension_ends_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) return null

    return evaluateAccountAccess(data)
  } catch {
    return null
  }
}
