import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  }

  const supabase = await createClient()

  // Si el tarjetón que se elimina es el activo, restablecer el contexto a AUTO_LATEST
  const { data: activeCtx } = await supabase
    .from("worker_active_context")
    .select("active_payslip_id")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (activeCtx?.active_payslip_id === body.id) {
    await supabase
      .from("worker_active_context")
      .update({
        active_payslip_id: null,
        selection_mode: "AUTO_LATEST",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user.id)
  }

  const { error } = await supabase
    .from("imported_payslips")
    .delete()
    .eq("id", body.id)
    .eq("user_id", auth.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    revalidatePath("/vacaciones")
    revalidatePath("/profile/mi-informacion-laboral")
    revalidatePath("/calculadoras")
    revalidatePath("/guia")
    revalidatePath("/")
  } catch (revalErr) {
    console.warn("[tarjeton/delete] revalidatePath warning:", revalErr)
  }

  return NextResponse.json({ ok: true })
}
