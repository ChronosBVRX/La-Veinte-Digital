export interface BotMessage {
  role: "user" | "assistant"
  content: string
  /** Fuentes verificables (solo mensajes del asistente). */
  fuentes?: BotFuente[]
  /** Chips de acción (solo mensajes del asistente). */
  chips?: string[]
}

/** Espejo del payload `fuentes[]` que entrega /api/consulta. */
export interface BotFuente {
  id?: string
  documento?: string
  version?: string
  tipo?: string
  numero?: string
  paginaInicio?: number
  paginaFin?: number
  fragmento?: string
  sourceUrl?: string
  validity?: string
  advertenciaVigencia?: string
}

export type BotErrorCode = "network" | "quota" | "server" | "empty"

export class BotError extends Error {
  constructor(
    public code: BotErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "BotError"
  }
}

export function botErrorMessage(code: BotErrorCode): string {
  switch (code) {
    case "network":
      return "No pude conectar con el servidor. Verifica tu conexión e intenta de nuevo."
    case "quota":
      return "Alcanzaste el límite diario de consultas. Intenta de nuevo mañana."
    case "empty":
      return "No recibí una respuesta válida. Reformula tu pregunta."
    default:
      return "El servidor tuvo un problema al responder. Intenta de nuevo en unos minutos."
  }
}

export async function consultarBot(history: BotMessage[]): Promise<{ respuesta: string; fuentes: BotFuente[]; chips: string[] }> {
  // Sanea el historial: @/shared/contracts/consulta valida que cada mensaje
  // tenga EXACTAMENTE {role, content} y 1..2000 chars. BotMessage trae
  // fuentes/chips en respuestas del asistente; si se reenvían tal cual,
  // el segundo turno falla con 400 "Cada mensaje debe tener únicamente
  // role y content". También recorta a 2000 para evitar rechazos cuando
  // la respuesta del asistente (hasta 550 tokens) roza el límite.
  const cleanHistory = history.map(({ role, content }) => ({
    role,
    content: content.slice(0, 2000),
  }))
  let res: Response
  try {
    res = await fetch("/api/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: cleanHistory }),
    })
  } catch (err) {
    throw new BotError("network", err instanceof Error ? err.message : "Network error")
  }

  if (res.status === 429) {
    throw new BotError("quota", `Quota exceeded (429)`)
  }
  if (!res.ok) {
    throw new BotError("server", `Bot API error (${res.status}): ${await res.text()}`)
  }

  const data = await res.json().catch(() => null)
  const respuesta = typeof data?.respuesta === "string" ? data.respuesta : ""
  if (!respuesta) {
    throw new BotError("empty", "Empty response")
  }
  const fuentes = Array.isArray(data?.fuentes) ? (data.fuentes as BotFuente[]) : []
  const chips = Array.isArray(data?.chips) ? (data.chips as string[]) : []
  return { respuesta, fuentes, chips }
}
