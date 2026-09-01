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

export const MAX_RATE_LIMIT_ENTRIES = 1000
export const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minuto
export const RATE_LIMIT_MAX_REQUESTS = 10 // máx 10 por minuto por usuario

export interface RateLimitRecord {
  count: number
  resetAt: number
}

export const userRateLimits = new Map<string, RateLimitRecord>()

export function checkRateLimit(
  userId: string,
  now = Date.now(),
  store = userRateLimits,
  maxEntries = MAX_RATE_LIMIT_ENTRIES,
  maxRequests = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; retryAfter?: number } {
  // 1. Limpieza de entradas expiradas
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) {
      store.delete(k)
    }
  }

  const existing = store.get(userId)
  if (existing) {
    if (existing.resetAt > now) {
      if (existing.count >= maxRequests) {
        const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
      }
      existing.count++
      return { allowed: true }
    } else {
      existing.count = 1
      existing.resetAt = now + windowMs
      return { allowed: true }
    }
  }

  // 2. Si se alcanzó el límite estricto de capacidad en memoria, desalojar las entradas con resetAt más cercano
  while (store.size >= maxEntries) {
    let oldestKey: string | null = null
    let oldestResetAt = Infinity
    for (const [k, v] of store.entries()) {
      if (v.resetAt < oldestResetAt) {
        oldestResetAt = v.resetAt
        oldestKey = k
      }
    }
    if (oldestKey) {
      store.delete(oldestKey)
    } else {
      const firstKey = store.keys().next().value
      if (firstKey) store.delete(firstKey)
      else break
    }
  }

  // 3. Registrar nueva entrada
  store.set(userId, { count: 1, resetAt: now + windowMs })
  return { allowed: true }
}

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
