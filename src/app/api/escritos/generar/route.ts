import { requireUser } from "@/shared/server/auth/require-user"
import { parseGenerarEscritoRequest } from "@/shared/contracts/escrito-draft"
import { generarEscritoService } from "@/features/escritos/server/generar-escrito-service"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"

export async function POST(req: Request) {
  const requestId = `esc-${crypto.randomUUID()}`
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "El cuerpo de la solicitud debe ser un JSON válido.", requestId, "invalid_request")
  }

  const parsed = parseGenerarEscritoRequest(body)
  if (!parsed.ok) {
    return privateJsonError(400, parsed.error, requestId, "invalid_request")
  }

  try {
    const result = await generarEscritoService(parsed.value)
    return privateJson(result)
  } catch (error) {
    console.error("[api/escritos/generar] Error generando escrito:", error)
    return privateJsonError(500, "Ocurrió un error al generar el escrito. Por favor intenta de nuevo.", requestId, "internal_error")
  }
}
