import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { getCajaSession, clearCajaSession } from "@/lib/caja/session"
import { CajaClient } from "@/lib/caja/client"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const authCheck = await requireCajaAccess(auth.user)
  if (authCheck.response) return authCheck.response

  const session = await getCajaSession()
  if (!session) {
    return NextResponse.json(
      { error: "No hay sesión activa en Caja de Ahorro", code: "unauthenticated" },
      { status: 401 },
    )
  }

  try {
    const client = new CajaClient({ getToken: () => session.authToken })
    const res = await client.getBalance(session.accountId)
    return NextResponse.json({
      ok: true,
      balance: res.payload ?? null,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500

    // Si el servidor de Caja rechazó el token (401/403), la sesión remota está muerta:
    if (status === 401 || status === 403 || /token.*(expir|inv[aá]l)/i.test(e.apiMessage || e.message || "")) {
      await clearCajaSession()
      return NextResponse.json(
        {
          error: "La sesión en Caja de Ahorro ha expirado. Por favor ingresa nuevamente.",
          code: "session_expired",
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al consultar saldos",
        code: e.code || "balance_error",
      },
      { status },
    )
  }
}
