import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { confirmTarjetonService } from "@/features/tarjeton/services/confirm-tarjeton"

/**
 * POST /api/tarjeton/confirm
 *
 * Confirma un tarjetón IMSS previamente extraído y revisado por el
 * trabajador. El PDF original NO se envía: solo el resultado estructurado
 * y la huella SHA-256 del archivo. La persistencia es atómica (RPC).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) {
    return auth.response
  }
  const user = auth.user

  const supabase = await createClient()

  // Inicialización idempotente del perfil ANTES de persistir: imported_payslips
  // tiene FK a public.profiles(id). Un usuario autenticado sin fila (p. ej.
  // creado antes del trigger) provocaría un 23503. No se usa service role: el
  // RPC corre con la sesión del usuario y RLS sigue aislando por auth.uid().
  const { error: ensureProfileError } = await supabase.rpc("ensure_profile_exists")
  if (ensureProfileError) {
    console.error("[tarjeton/confirm][ensure_profile]", { code: ensureProfileError.code })
    return NextResponse.json(
      { error: "No se pudo preparar tu perfil para guardar el tarjetón.", code: "profile_init_failed" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const result = await confirmTarjetonService(
    {
      userId: user.id,
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn as "confirm_imported_payslip", args as never)
        if (error) {
          console.error("[tarjeton/confirm][supabase]", { code: error.code, message: error.message, details: error.details, hint: error.hint })
        }
        return {
          data,
          error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null,
        }
      },
    },
    body,
  )

  if (!result.ok) {
    const status = result.error.code === "unauthorized" ? 401
      : result.error.code === "invalid_payload" || result.error.code === "template_not_detected" ? 400
      : result.error.code === "consent_required" ? 403
      : result.error.code === "totals_mismatch" || result.error.code === "matricula_mismatch" || result.error.code === "duplicate" || result.error.code === "limits_exceeded" ? 422
      : 500
    return NextResponse.json(result.error, { status })
  }

  try {
    revalidatePath("/vacaciones")
    revalidatePath("/profile/mi-informacion-laboral")
    revalidatePath("/calculadoras")
    revalidatePath("/guia")
    revalidatePath("/")
  } catch (revalErr) {
    console.warn("[tarjeton/confirm] revalidatePath warning:", revalErr)
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
