/**
 * Política centralizada del Asistente SNTSS.
 *
 * Modelos, límites, timeouts y cuotas viven aquí para que la ruta API y
 * las pruebas compartan la misma versión de la política.
 */

export const ASSISTANT_POLICY = {
  /** Modelo de embeddings. Seleccionable vía env; default moderno. */
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",

  /** Modelo de chat. Seleccionable vía env. */
  chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",

  /** Dimensiones esperadas del vectorstore. Debe coincidir con el modelo. */
  embeddingDimensions: 1536,

  /** Mensajes de historial (límite por cantidad). */
  maxHistoryMessages: 20,

  /** Caracteres máximos por mensaje individual. */
  maxContentChars: 2000,

  /** Caracteres máximos acumulados en todo el historial. */
  maxTotalChars: 12_000,

  /** Caracteres máximos de la pregunta actual. */
  maxQuestionChars: 2000,

  /** Cuota diaria de consultas por usuario. */
  dailyQuotaPerUser: 100,

  /** Timeout para generar embeddings (ms). */
  embeddingTimeoutMs: 15_000,

  /** Timeout para completar la respuesta del modelo (ms). */
  completionTimeoutMs: 30_000,

  /** Timeout para invocar el backend Python alternativo (ms). */
  pythonBotTimeoutMs: 30_000,

  /** Fragmentos máximos a incluir en el contexto. */
  maxContextChunks: 8,

  /** Caracteres máximos del contexto recuperado. */
  maxContextChars: 24_000,

  /** Temperatura fija: 0 para minimizar aleatoriedad. */
  temperature: 0,
} as const

/**
 * Ejecuta una operación asíncrona con un timeout aislado.
 * El temporizador se cancela si la operación termina antes.
 */
export async function withAbortTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await operation(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Recorta el historial por presupuesto de caracteres, conservando los
 * mensajes más recientes sin exceder `maxChars`.
 */
export function trimHistoryByBudget<T extends { content: string }>(
  history: T[],
  maxChars: number = ASSISTANT_POLICY.maxTotalChars,
): T[] {
  const selected: T[] = []
  let used = 0

  for (const message of [...history].reverse()) {
    const len = message.content.length
    if (used + len > maxChars) break
    selected.push(message)
    used += len
  }

  return selected.reverse()
}
