import "server-only"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export type RequirePlatformAdminResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse }

function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "No autorizado", code: "forbidden" },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  )
}

/**
 * Autorización administrativa de plataforma para rutas API.
 *
 * Solo `profiles.role = 'admin'` habilita el Centro de Administración de
 * Usuarios. Los correos de operador push heredados (PUSH_ADMIN_ALLOWED_EMAILS)
 * y los roles sindicales (union_rep / union_admin, en union_members) NO
 * otorgan privilegios administrativos globales.
 *
 * Nunca acepta un userId del navegador: la sesión se resuelve con
 * `auth.getUser()`. El objetivo de una operación jamás se valida aquí; cada
 * RPC valida al actor y al objetivo dentro de la misma transacción.
 */
export async function requirePlatformAdmin(knownUser?: User | null): Promise<RequirePlatformAdminResult> {
  const supabase = await createClient()

  let user: User | null = knownUser ?? null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user ?? null
  }

  if (!user) {
    return { user: null, response: forbiddenResponse() }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (error || profile?.role !== "admin") {
    return { user: null, response: forbiddenResponse() }
  }

  return { user, response: null }
}
