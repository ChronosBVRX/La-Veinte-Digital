import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { getCajaSession } from "@/lib/caja/session"
import { CajaClient } from "@/lib/caja/client"
import { validateClabe, maskClabe } from "@/features/caja/lib/clabe"
import type { RetiroTipo, RetiroBody } from "@/lib/caja/models"

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
    const json = (await req.json()) as {
      tipo?: RetiroTipo
      monto?: number
      cuentaClabe?: string
      concepto?: string
    }

    const tipo = json.tipo || "PARCIAL"
    const monto = typeof json.monto === "number" ? json.monto : Number(json.monto)
    const rawClabe = json.cuentaClabe || ""

    if (!monto || Number.isNaN(monto) || monto <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a cero", code: "invalid_amount" },
        { status: 400 },
      )
    }

    const clabeResult = validateClabe(rawClabe)
    if (!clabeResult.isValid) {
      return NextResponse.json(
        { error: clabeResult.error || "CLABE interbancaria inválida", code: "invalid_clabe" },
        { status: 400 },
      )
    }

    const client = new CajaClient({ getToken: () => session.authToken })

    const retiroBody: RetiroBody = {
      monto,
      cuentaClabe: rawClabe.trim(),
      banco: clabeResult.bankName,
      concepto: json.concepto?.trim() || "Retiro Caja Digital",
    }

    let result: unknown = null
    if (tipo === "PARCIAL") {
      result = await client.withdrawPartial(session.accountId, retiroBody)
    } else if (tipo === "TOTAL") {
      result = await client.withdraw(session.accountId, retiroBody)
    } else if (tipo === "QUINCENAL") {
      result = await client.withdrawBiweekly(session.accountId, retiroBody)
    } else {
      return NextResponse.json(
        { error: "Tipo de retiro no soportado (use PARCIAL, TOTAL o QUINCENAL)", code: "invalid_type" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      tipo,
      monto,
      cuentaClabe: maskClabe(rawClabe),
      banco: clabeResult.bankName,
      resultado: result,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    return NextResponse.json(
      {
        error: e.apiMessage || e.message || "Error al procesar retiro",
        code: e.code || "withdraw_error",
      },
      { status },
    )
  }
}
