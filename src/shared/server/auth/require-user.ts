import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type RequireUserResult =
  | { user: import("@supabase/supabase-js").User; response: null }
  | { user: null; response: NextResponse }

/**
 * Autenticación uniforme para rutas API privadas.
 *
 * Crea el cliente Supabase de servidor y obtiene el usuario de la sesión vía
 * `auth.getUser()`. Nunca acepta un `userId` proveniente del navegador.
 * Devuelve una respuesta 401 uniforme cuando no hay sesión.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "No autenticado", code: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      ),
    }
  }

  return { user: data.user, response: null }
}
