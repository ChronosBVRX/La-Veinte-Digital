import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { clearCajaSession } from "@/lib/caja/session"

export async function POST() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  await clearCajaSession()
  return NextResponse.json({ ok: true })
}
