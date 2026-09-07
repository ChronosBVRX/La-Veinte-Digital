import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"

/**
 * POST /api/tarjeton/select
 *
 * Permite al usuario fijar un tarjetón específico como activo (PINNED)
 * o restablecer la selección al tarjetón cronológicamente más reciente (AUTO_LATEST).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) {
    return auth.response
  }

  let body: { action?: "pin" | "auto_latest"; payslipId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const action = body.action || (body.payslipId ? "pin" : "auto_latest")
  const payslipId = body.payslipId

  if (action === "pin" && (!payslipId || typeof payslipId !== "string")) {
    return NextResponse.json({ error: "payslipId es requerido para fijar un tarjetón" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("set_active_payslip", {
    p_payslip_id: payslipId || "00000000-0000-0000-0000-000000000000",
    p_selection_mode: action === "pin" ? "PINNED" : "AUTO_LATEST",
  })

  if (error) {
    console.error("[api/tarjeton/select] RPC error:", error)
    if (error.message.includes("payslip_not_found_or_not_owned")) {
      return NextResponse.json({ error: "El tarjetón no existe o no pertenece a tu cuenta." }, { status: 404 })
    }
    if (error.message.includes("matricula_mismatch")) {
      return NextResponse.json({ error: "El tarjetón no coincide con la matrícula de tu perfil." }, { status: 422 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    revalidatePath("/vacaciones")
    revalidatePath("/profile/mi-informacion-laboral")
    revalidatePath("/calculadoras")
    revalidatePath("/guia")
    revalidatePath("/")
  } catch (revalidateErr) {
    console.warn("[api/tarjeton/select] revalidatePath falló:", revalidateErr)
  }

  return NextResponse.json(data ?? { ok: true })
}
