import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { getCajaSession, clearCajaSession } from "@/lib/caja/session"
import { CajaClient } from "@/lib/caja/client"

export async function POST() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const session = await getCajaSession()
  if (session?.authToken && session?.matricula) {
    try {
      const client = new CajaClient({ getToken: () => session.authToken })
      await client.logoutServer(session.matricula)
    } catch {
      // Ignorar si el token ya expiró o el servidor de Caja responde 403
    }
  }

  await clearCajaSession()
  return NextResponse.json({ ok: true })
}
