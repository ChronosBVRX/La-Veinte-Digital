import { NextRequest, NextResponse } from "next/server"
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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const auth = await requireUser()
  if (auth.response) {
    return auth.response
  }
  const user = auth.user

  const supabase = await createClient()

  const result = await confirmTarjetonService(
    {
      userId: user.id,
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn as "confirm_imported_payslip", args as never)
        return { data, error: error ? { message: error.message } : null }
      },
    },
    body,
  )

  if (!result.ok) {
    const status = result.error.code === "unauthorized" ? 401
      : result.error.code === "invalid_payload" || result.error.code === "template_not_detected" ? 400
      : result.error.code === "totals_mismatch" || result.error.code === "matricula_mismatch" || result.error.code === "duplicate" || result.error.code === "limits_exceeded" ? 422
      : 500
    return NextResponse.json(result.error, { status })
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
