import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { recordEscritoGeneration } from "@/features/escritos/server/escritos-stats-service"

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (!user) {
    return response
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const tipoEscrito = typeof body.tipoEscrito === "string" ? body.tipoEscrito : "general"
    const modo = typeof body.modo === "string" ? body.modo : "manual"

    const result = await recordEscritoGeneration({
      userId: user.id,
      tipoEscrito,
      modo,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/escritos/log] Error registrando generación:", error)
    return NextResponse.json(
      { error: "Error al registrar generación." },
      { status: 500 }
    )
  }
}
