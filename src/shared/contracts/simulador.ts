/**
 * Contrato del simulador de audiencias disciplinarias.
 *
 * Una sola fuente de verdad para:
 * - Escenarios registrados (el servidor NUNCA cae silenciosamente a `faltas`).
 * - Validación estricta de la solicitud (rechaza propiedades desconocidas).
 * - Validación de respuestas estructuradas de la IA (nunca JSON.parse ciego).
 */

export const SIMULADOR_SCENARIOS = [
  "faltas",
  "maltrato",
  "incumplimiento",
  "extravio",
  "retardo",
  "confidencialidad",
] as const

export type SimuladorScenarioId = (typeof SIMULADOR_SCENARIOS)[number]

export type SimuladorDifficulty = 1 | 2

export type SimuladorAction = "chat" | "analyze"

export type SimuladorMessageRole = "user" | "assistant"

export interface SimuladorMessage {
  role: SimuladorMessageRole
  content: string
}

export interface SimuladorRequest {
  action: SimuladorAction
  scenario: SimuladorScenarioId
  difficulty: SimuladorDifficulty
  history: SimuladorMessage[]
}

export const SIMULADOR_MAX_HISTORY = 20
export const SIMULADOR_MAX_CONTENT_CHARS = 2000
export const SIMULADOR_DAILY_QUOTA = 60

export type SimuladorParseResult =
  | { ok: true; value: SimuladorRequest }
  | { ok: false; error: string }

const SIMULADOR_SCENARIO_SET = new Set<string>(SIMULADOR_SCENARIOS)

function isScenarioId(value: unknown): value is SimuladorScenarioId {
  return typeof value === "string" && SIMULADOR_SCENARIO_SET.has(value)
}

function isDifficulty(value: unknown): value is SimuladorDifficulty {
  return value === 1 || value === 2
}

function isRole(value: unknown): value is SimuladorMessageRole {
  return value === "user" || value === "assistant"
}

/**
 * Valida el cuerpo de POST /api/simulador con un esquema estricto:
 * - `action`: únicamente `chat` o `analyze`.
 * - `scenario`: uno de los seis escenarios registrados.
 * - `difficulty`: 1 o 2.
 * - `history`: máximo 20 mensajes, roles `user`/`assistant` y contenido
 *   entre 1 y 2,000 caracteres.
 * - Propiedades desconocidas se rechazan.
 */
export function parseSimuladorRequest(body: unknown): SimuladorParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "El cuerpo debe ser un objeto JSON" }
  }

  const record = body as Record<string, unknown>

  const allowedKeys = ["action", "scenario", "difficulty", "history"]
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `Propiedad desconocida: ${key}` }
    }
  }

  if (record.action !== "chat" && record.action !== "analyze") {
    return { ok: false, error: "action debe ser 'chat' o 'analyze'" }
  }

  if (!isScenarioId(record.scenario)) {
    return {
      ok: false,
      error: `scenario debe ser uno de: ${SIMULADOR_SCENARIOS.join(", ")}`,
    }
  }

  if (!isDifficulty(record.difficulty)) {
    return { ok: false, error: "difficulty debe ser 1 o 2" }
  }

  if (!Array.isArray(record.history)) {
    return { ok: false, error: "history debe ser un arreglo" }
  }

  if (record.history.length > SIMULADOR_MAX_HISTORY) {
    return {
      ok: false,
      error: `history no puede exceder ${SIMULADOR_MAX_HISTORY} mensajes`,
    }
  }

  const history: SimuladorMessage[] = []
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
    if (trimmed.length < 1 || trimmed.length > SIMULADOR_MAX_CONTENT_CHARS) {
      return {
        ok: false,
        error: `Cada mensaje debe tener entre 1 y ${SIMULADOR_MAX_CONTENT_CHARS} caracteres`,
      }
    }
    history.push({ role: msg.role, content: msg.content })
  }

  if (history.length === 0) {
    return { ok: false, error: "history no puede estar vacío" }
  }

  return {
    ok: true,
    value: {
      action: record.action,
      scenario: record.scenario,
      difficulty: record.difficulty,
      history,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Respuestas estructuradas de la IA                                  */
/* ------------------------------------------------------------------ */

export type SimuladorInquisitorState =
  | "neutral"
  | "inquisitivo"
  | "presionando"
  | "desaprobando"

export const SIMULADOR_INQUISITOR_STATES: SimuladorInquisitorState[] = [
  "neutral",
  "inquisitivo",
  "presionando",
  "desaprobando",
]

export interface SimuladorChatResponse {
  respuesta: string
  presion: number
  estado: SimuladorInquisitorState
}

export interface SimuladorAnalysisResponse {
  puntajeCalma: number
  puntajeFirmeza: number
  erroresTacticos: string[]
  fortalezas: string[]
  articulosRelevantes: string[]
  resumen: string
}

const INQUISITOR_STATE_SET = new Set<string>(SIMULADOR_INQUISITOR_STATES)

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  )
}

/**
 * Valida la respuesta de chat de la IA contra un esquema estricto.
 * Una respuesta inválida nunca se convierte en texto mediante limpieza
 * de llaves y comillas; quien llama decide recuperar o fallar.
 */
export function parseSimuladorChatResponse(raw: unknown): SimuladorChatResponse | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.mensaje !== "string" || record.mensaje.trim().length === 0) return null
  if (!isInteger(record.presion) || record.presion < 1 || record.presion > 10) return null
  if (
    typeof record.estado !== "string" ||
    !INQUISITOR_STATE_SET.has(record.estado)
  ) {
    return null
  }
  return {
    respuesta: record.mensaje,
    presion: record.presion,
    estado: record.estado as SimuladorInquisitorState,
  }
}

/**
 * Valida la respuesta de análisis de desempeño. Los puntajes deben ser
 * enteros de 0 a 100; los arreglos de texto no pueden estar vacíos de
 * forma indefinida (se permiten vacíos solo como degradación controlada
 * del llamador, nunca como resultado del parseo de texto corrupto).
 */
export function parseSimuladorAnalysisResponse(
  raw: unknown,
): SimuladorAnalysisResponse | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (!isInteger(record.puntajeCalma) || record.puntajeCalma < 0 || record.puntajeCalma > 100) return null
  if (!isInteger(record.puntajeFirmeza) || record.puntajeFirmeza < 0 || record.puntajeFirmeza > 100) return null
  if (!isStringArray(record.erroresTacticos)) return null
  if (!isStringArray(record.fortalezas)) return null
  if (!isStringArray(record.articulosRelevantes)) return null
  if (typeof record.resumen !== "string" || record.resumen.trim().length === 0) return null
  return {
    puntajeCalma: record.puntajeCalma,
    puntajeFirmeza: record.puntajeFirmeza,
    erroresTacticos: record.erroresTacticos,
    fortalezas: record.fortalezas,
    articulosRelevantes: record.articulosRelevantes,
    resumen: record.resumen,
  }
}
