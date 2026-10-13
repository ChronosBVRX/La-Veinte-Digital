import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { isCajaPubliclyEnabled, setCajaPubliclyEnabled } from "@/lib/caja/visibility"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const isPublic = await isCajaPubliclyEnabled()
  return NextResponse.json({ public_enabled: isPublic })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const adminCheck = await requirePlatformAdmin(auth.user)
  if (adminCheck.response) return adminCheck.response

  try {
    const json = (await req.json()) as { public_enabled?: boolean }
    const enabled = Boolean(json.public_enabled)

    await setCajaPubliclyEnabled(enabled, adminCheck.user.id)

    return NextResponse.json({
      ok: true,
      public_enabled: enabled,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al actualizar visibilidad de Caja"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
