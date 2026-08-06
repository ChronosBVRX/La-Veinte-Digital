/**
 * Clasificación y logging sanitizado de errores del Asistente SNTSS.
 *
 * Nunca registra la pregunta completa, datos del trabajador ni contenido
 * sensible. Incluye suficiente contexto técnico para operar sin exponer
 * información personal.
 */

export type AssistantErrorCode =
  | "openai_unavailable"
  | "embedding_failed"
  | "completion_failed"
  | "vectorstore_mismatch"
  | "timeout"
  | "quota_exceeded"
  | "quota_error"
  | "invalid_request"
  | "python_bot_unavailable"
  | "internal"

export interface ClassifiedAssistantError {
  code: AssistantErrorCode
  httpStatus: number
  retryable: boolean
  publicMessage: string
  internalMessage: string
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function isOpenAIError(error: unknown): error is { type?: string; status?: number; message: string } {
  return typeof error === "object" && error !== null && "message" in error
}

export function classifyAssistantError(error: unknown, context: "direct" | "python" | "quota" = "direct"): ClassifiedAssistantError {
  if (isAbortError(error)) {
    return {
      code: "timeout",
      httpStatus: 504,
      retryable: true,
      publicMessage: "La consulta tardó demasiado. Inténtalo de nuevo en unos segundos.",
      internalMessage: error instanceof Error ? error.message : "AbortError",
    }
  }

  if (context === "quota") {
    return {
      code: "quota_error",
      httpStatus: 503,
      retryable: true,
      publicMessage: "No se pudo verificar tu cuota. Intenta de nuevo en unos minutos.",
      internalMessage: error instanceof Error ? error.message : String(error),
    }
  }

  if (context === "python") {
    return {
      code: "python_bot_unavailable",
      httpStatus: 502,
      retryable: true,
      publicMessage: "El motor alternativo no respondió; se intentará el motor principal.",
      internalMessage: error instanceof Error ? error.message : String(error),
    }
  }

  if (isOpenAIError(error)) {
    const status = error.status ?? 500
    const message = error.message ?? "OpenAI error"
    if (status === 401 || status === 403) {
      return {
        code: "openai_unavailable",
        httpStatus: 502,
        retryable: false,
        publicMessage: "El servicio de IA no está disponible en este momento. Contacta a soporte.",
        internalMessage: `OpenAI auth ${status}: ${message}`,
      }
    }
    if (message.toLowerCase().includes("embedding")) {
      return {
        code: "embedding_failed",
        httpStatus: 502,
        retryable: status >= 500 || status === 429,
        publicMessage: "No se pudo preparar la consulta. Inténtalo de nuevo.",
        internalMessage: `OpenAI embedding ${status}: ${message}`,
      }
    }
    return {
      code: "completion_failed",
      httpStatus: 502,
      retryable: status >= 500 || status === 429,
      publicMessage: "No se pudo generar la respuesta. Inténtalo de nuevo.",
      internalMessage: `OpenAI completion ${status}: ${message}`,
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("dimension")) {
    return {
      code: "vectorstore_mismatch",
      httpStatus: 500,
      retryable: false,
      publicMessage: "No se pudo verificar la respuesta contra los documentos. Contacta a soporte.",
      internalMessage: error.message,
    }
  }

  return {
    code: "internal",
    httpStatus: 500,
    retryable: false,
    publicMessage: "Ocurrió un error al procesar tu consulta.",
    internalMessage: error instanceof Error ? error.message : String(error),
  }
}

export interface AssistantErrorLog {
  requestId: string
  userId: string
  code: AssistantErrorCode
  retryable: boolean
  message: string
}

export function logAssistantError(log: AssistantErrorLog): void {
  console.error("[consulta]", {
    requestId: log.requestId,
    userId: log.userId,
    code: log.code,
    retryable: log.retryable,
    message: log.message,
  })
}
