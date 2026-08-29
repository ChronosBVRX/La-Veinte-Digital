import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"

/**
 * POST /api/push/register
 *
 * Registra/actualiza el token FCM de este dispositivo para el usuario autenticado.
 * Llama a la RPC `register_push_device` (RLS: solo el usuario autenticado puede
 * registrar SU token). El token lo obtiene el cliente nativo vía `getFcmToken()`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { token?: unknown; platform?: unknown; appVersion?: unknown; deviceModel?: unknown; androidVersion?: unknown } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const token = typeof body?.token === "string" ? body.token.trim() : ""
  if (token.length < 20) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("register_push_device" as never, {
    p_token: token,
    p_platform: typeof body?.platform === "string" ? body.platform : "android",
    p_app_version: typeof body?.appVersion === "string" ? body.appVersion : null,
    p_device_model: typeof body?.deviceModel === "string" ? body.deviceModel : null,
    p_android_version: typeof body?.androidVersion === "string" ? body.androidVersion : null,
  } as never)

  if (error) {
    console.error("[push/register]", { code: error.code, message: error.message })
    return NextResponse.json({ error: "No se pudo registrar el dispositivo" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } })
}
