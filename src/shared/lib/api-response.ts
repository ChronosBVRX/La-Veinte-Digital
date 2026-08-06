/**
 * Respuestas HTTP uniformes para rutas API privadas.
 *
 * Todas las respuestas privadas llevan `Cache-Control: private, no-store`
 * para evitar que navegadores, proxies o CDNs almacenen datos personales
 * o laborales.
 */

import { NextResponse } from "next/server"

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0"

function applyPrivateCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
  response.headers.set("Pragma", "no-cache")
  return response
}

/**
 * Respuesta JSON privada con caché deshabilitada.
 */
export function privateJson<T>(body: T, init: ResponseInit = {}): NextResponse {
  const response = NextResponse.json(body, init)
  return applyPrivateCache(response)
}

/**
 * Respuesta de error JSON privada con caché deshabilitada.
 */
export function privateJsonError(
  status: number,
  error: string,
  requestId: string,
  code?: string,
): NextResponse {
  return privateJson(
    { error, requestId, ...(code ? { code } : {}) },
    { status },
  )
}
