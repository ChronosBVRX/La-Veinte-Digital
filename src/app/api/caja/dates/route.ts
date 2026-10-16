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
    const res = await client.listDates(session.accountId)
    return NextResponse.json({
      ok: true,
      dates: res.payload ?? [],
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500

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
        error: e.apiMessage || e.message || "Error al consultar citas",
        code: e.code || "dates_error",
      },
      { status },
    )
  }
}

export async function PUT(req: Request) {
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
    const { searchParams } = new URL(req.url)
    const body = (await req.json().catch(() => ({}))) as { delegacionId?: string | number }
    const delegacionId = searchParams.get("delegacion") || body.delegacionId || 1

    const client = new CajaClient({ getToken: () => session.authToken })
    // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
    const res = await client.requestDate(session.accountId, delegacionId, body)

    return NextResponse.json({
      ok: true,
      resultado: res.payload ?? null,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al solicitar cita",
        code: e.code || "request_date_error",
      },
      { status },
    )
  }
}

export async function DELETE(req: Request) {
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
    const { searchParams } = new URL(req.url)
    const dateId = searchParams.get("dateId") || searchParams.get("id")

    if (!dateId) {
      return NextResponse.json(
        { error: "El identificador de cita (dateId) es requerido", code: "missing_date_id" },
        { status: 400 },
      )
    }

    const client = new CajaClient({ getToken: () => session.authToken })
    const res = await client.cancelDate(session.accountId, dateId)

    return NextResponse.json({
      ok: true,
      resultado: res.payload ?? null,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al cancelar cita",
        code: e.code || "cancel_date_error",
      },
      { status },
    )
  }
}
