import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("imported_payslips")
    .delete()
    .eq("id", body.id)
    .eq("user_id", auth.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
