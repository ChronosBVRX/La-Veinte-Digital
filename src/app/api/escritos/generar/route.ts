import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import {
  generarEscritoService,
  validateGenerarEscritoRequest,
} from "@/features/escritos/server/generar-escrito-service"

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (!user) {
    return response
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Formato de solicitud inválido." },
      { status: 400 }
    )
  }

  const validation = validateGenerarEscritoRequest(body)
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      { error: validation.error || "Datos incompletos para generar el escrito." },
      { status: 400 }
    )
  }

  try {
    const result = await generarEscritoService(validation.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/escritos/generar] Error:", error)
    return NextResponse.json(
      { error: "Error al generar el borrador. Intenta nuevamente." },
      { status: 500 }
    )
  }
}
