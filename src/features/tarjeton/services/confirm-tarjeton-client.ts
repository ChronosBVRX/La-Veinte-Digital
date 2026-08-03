/**
 * Confirmación de tarjetones desde el cliente.
 *
 * Envía únicamente el resultado estructurado y confirmado por el
 * trabajador (nunca el PDF) y normaliza los errores del endpoint.
 */
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse, ConfirmTarjetonErrorCode } from "@/shared/contracts/tarjeton-import"

export type ConfirmTarjetonClientResult = {
  ok: true
  data: ConfirmTarjetonResponse
} | {
  ok: false
  error: { code: ConfirmTarjetonErrorCode; message: string }
}

export async function confirmTarjetonClient(request: ConfirmTarjetonRequest): Promise<ConfirmTarjetonClientResult> {
  let response: Response
  try {
    response = await fetch("/api/tarjeton/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
    })
  } catch {
    return { ok: false, error: { code: "internal", message: "No hay conexión con el servidor. Intenta de nuevo." } }
  }

  if (response.ok) {
    try {
      const data = (await response.json()) as ConfirmTarjetonResponse
      return { ok: true, data }
    } catch {
      return { ok: false, error: { code: "internal", message: "El servidor devolvió una respuesta inválida." } }
    }
  }

  let error: { code: ConfirmTarjetonErrorCode; message: string } | null = null
  try {
    const body = (await response.json()) as { code?: ConfirmTarjetonErrorCode; message?: string }
    if (body.code && body.message) {
      error = { code: body.code, message: body.message }
    }
  } catch {
    // Cuerpo no JSON: se usa el código del status.
  }

  return {
    ok: false,
    error: error ?? {
      code: response.status === 401 ? "unauthorized" : "internal",
      message: response.status === 401 ? "Tu sesión expiró. Vuelve a iniciar sesión." : `Error inesperado (${response.status}).`,
    },
  }
}
