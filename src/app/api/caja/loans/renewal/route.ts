import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { getCajaSession } from "@/lib/caja/session"
import { CajaClient } from "@/lib/caja/client"

export async function POST(req: Request) {
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
    const body = await req.json().catch(() => ({}))
    const client = new CajaClient({ getToken: () => session.authToken })

    // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
    const res = await client.renewLoan(session.accountId, body)

    return NextResponse.json({
      ok: true,
      resultado: res.payload ?? null,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al procesar renovación de préstamo",
        code: e.code || "renewal_error",
      },
      { status },
    )
  }
}
