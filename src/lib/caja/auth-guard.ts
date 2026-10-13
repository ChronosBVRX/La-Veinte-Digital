import "server-only"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { isCajaPubliclyEnabled } from "./visibility"
import type { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

export type RequireCajaAccessResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse }

/**
 * Control de acceso al módulo de Caja SNTSS.
 * - Siempre exige que el usuario esté autenticado en La Veinte Digital.
 * - Si `isCajaPubliclyEnabled()` es true, cualquier usuario autenticado tiene acceso.
 * - Si es false (modo prueba/controlado), SOLO los administradores tienen acceso.
 */
export async function requireCajaAccess(user?: User): Promise<RequireCajaAccessResult> {
  let activeUser = user
  if (!activeUser) {
    const auth = await requireUser()
    if (auth.response) return auth
    activeUser = auth.user
  }

  const isPublic = await isCajaPubliclyEnabled()
  if (isPublic) {
    return { user: activeUser, response: null }
  }

  const allowedEmails = (process.env.PUSH_ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (activeUser.email && allowedEmails.includes(activeUser.email.toLowerCase())) {
    return { user: activeUser, response: null }
  }

  return requirePlatformAdmin(activeUser)
}
