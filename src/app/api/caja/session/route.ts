import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { getCajaSession } from "@/lib/caja/session"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const authCheck = await requireCajaAccess(auth.user)
  if (authCheck.response) return authCheck.response

  const session = await getCajaSession()

  if (!session) {
    return NextResponse.json({
      authenticated: false,
    })
  }

  return NextResponse.json({
    authenticated: true,
    matricula: session.matricula,
    accountId: session.accountId,
    nombre: session.nombre,
    expiresAt: session.expiresAt,
  })
}
