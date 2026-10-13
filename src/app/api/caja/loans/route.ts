import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { getCajaSession } from "@/lib/caja/session"
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
    let estimate: unknown = null
    let renewal: unknown = null

    try {
      const estRes = await client.getLoanEstimate(session.accountId)
      estimate = estRes.payload ?? null
    } catch {
      estimate = null
    }

    try {
      const renRes = await client.getLoanRenewal(session.accountId)
      renewal = renRes.payload ?? null
    } catch {
      renewal = null
    }

    return NextResponse.json({
      ok: true,
      estimate,
      renewal,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al consultar información de préstamos",
        code: e.code || "loan_error",
      },
      { status },
    )
  }
}
