/**
 * Endpoint de generación de escritos con IA.
 * Requiere autenticación de usuario (requireUser) y aplica rate-limiting en memoria por proceso.
 * NOTA: Este rate-limiting es en memoria local por instancia de proceso/serverless; no es una
 * solución distribuida tipo Redis/KV, pero previene ráfagas abusivas por usuario en la instancia
 * y garantiza de forma determinista un límite estricto superior de memoria (MAX_RATE_LIMIT_ENTRIES).
 * La Veinte Digital
 */

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import {
  generarEscritoService,
  validateGenerarEscritoRequest,
} from "@/features/escritos/server/generar-escrito-service"
import { checkRateLimit } from "@/features/escritos/server/rate-limit"

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (!user) {
    return response
  }

  const rateCheck = checkRateLimit(user.id)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Has alcanzado el límite de solicitudes. Espera un momento antes de generar otro escrito." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter || 60),
        },
      }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Formato de solicitud JSON inválido." },
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
