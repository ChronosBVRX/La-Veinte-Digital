import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import {
  generarEscritoService,
  validateGenerarEscritoRequest,
} from "@/features/escritos/server/generar-escrito-service"

const userRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = userRateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    userRateLimits.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) {
    return false
  }
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (!user) {
    return response
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Has alcanzado el límite de solicitudes. Espera un momento antes de generar otro escrito." },
      { status: 429 }
    )
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
