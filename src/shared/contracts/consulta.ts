/**
 * Contrato de POST /api/consulta (Asistente SNTSS).
 *
 * Misma disciplina que el contrato del simulador:
 * - Roles únicamente `user` | `assistant` (nunca `system` desde el cliente).
 * - Cada mensaje limitado, historial limitado, propiedades desconocidas
 *   rechazadas.
 */

export type ConsultaMessageRole = "user" | "assistant"

export interface ConsultaMessage {
  role: ConsultaMessageRole
  content: string
}

export interface ConsultaRequest {
  history: ConsultaMessage[]
}

export const CONSULTA_MAX_HISTORY = 20
export const CONSULTA_MAX_CONTENT_CHARS = 2000
export const CONSULTA_MAX_TOTAL_CHARS = 40000
export const CONSULTA_DAILY_QUOTA = 100

export type ConsultaParseResult =
  | { ok: true; value: ConsultaRequest }
  | { ok: false; error: string }

function isRole(value: unknown): value is ConsultaMessageRole {
  return value === "user" || value === "assistant"
}

/**
 * Valida el cuerpo de POST /api/consulta con un esquema estricto:
 * - `history`: máximo 20 mensajes, roles `user`/`assistant`, contenido
 *   entre 1 y 2,000 caracteres cada uno.
 * - Propiedades desconocidas se rechazan.
 */
export function parseConsultaRequest(body: unknown): ConsultaParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "El cuerpo debe ser un objeto JSON" }
  }

  const record = body as Record<string, unknown>

  const allowedKeys = ["history"]
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `Propiedad desconocida: ${key}` }
    }
  }

  if (!Array.isArray(record.history)) {
    return { ok: false, error: "history debe ser un arreglo" }
  }

  if (record.history.length > CONSULTA_MAX_HISTORY) {
    return {
      ok: false,
      error: `history no puede exceder ${CONSULTA_MAX_HISTORY} mensajes`,
    }
  }

  const history: ConsultaMessage[] = []
  let totalChars = 0
  for (const item of record.history) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, error: "Cada mensaje debe ser un objeto" }
    }
    const msg = item as Record<string, unknown>
    const keys = Object.keys(msg)
    if (keys.length !== 2 || !keys.includes("role") || !keys.includes("content")) {
      return { ok: false, error: "Cada mensaje debe tener únicamente role y content" }
    }
    if (!isRole(msg.role)) {
      return { ok: false, error: "El rol de cada mensaje debe ser 'user' o 'assistant'" }
    }
    if (typeof msg.content !== "string") {
      return { ok: false, error: "El contenido de cada mensaje debe ser texto" }
    }
    const trimmed = msg.content.trim()
    if (trimmed.length < 1 || trimmed.length > CONSULTA_MAX_CONTENT_CHARS) {
      return {
        ok: false,
        error: `Cada mensaje debe tener entre 1 y ${CONSULTA_MAX_CONTENT_CHARS} caracteres`,
      }
    }
    totalChars += trimmed.length
    if (totalChars >= CONSULTA_MAX_TOTAL_CHARS) {
      return { ok: false, error: "El historial acumulado excede el límite permitido" }
    }
    history.push({ role: msg.role, content: msg.content })
  }

  if (history.length === 0) {
    return { ok: false, error: "history no puede estar vacío" }
  }

  return {
    ok: true,
    value: { history },
  }
}
