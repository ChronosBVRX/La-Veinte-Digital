/**
 * Reintento único para fallos transitorios de las consultas del Home.
 *
 * Requisitos: máximo un segundo intento, sin loops, sin polling y sin recargar
 * la página. Los errores permanentes (permisos/RLS, esquema, query inválida)
 * no se reintentan: se devuelven tal cual para que el llamador los trate como
 * estado desconocido, jamás como ausencia de dato.
 */

export interface QueryResultLike {
  error: unknown
  status?: number
}

const TRANSIENT_PG_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "40001",
  "40P01",
  "53300",
  "53400",
  "57P01",
  "57P02",
  "57P03",
  "57014",
  "PGRST003",
])

export function isTransientQueryFailure(result: QueryResultLike): boolean {
  if (!result.error) return false
  if (result.status === 0) return true
  if (
    typeof result.status === "number" &&
    (result.status === 408 || result.status === 429 || result.status >= 500)
  ) {
    return true
  }
  const code = (result.error as { code?: unknown }).code
  if (typeof code !== "string" || code === "") return true
  return TRANSIENT_PG_CODES.has(code)
}

export const SINGLE_RETRY_DELAY_MS = 250

export async function withSingleRetry<T extends QueryResultLike>(
  run: () => PromiseLike<T> | T,
  delayMs: number = SINGLE_RETRY_DELAY_MS,
): Promise<{ value: T; attempts: number }> {
  const first = await run()
  if (!isTransientQueryFailure(first)) return { value: first, attempts: 1 }

  if (delayMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  }

  const second = await run()
  return { value: second, attempts: 2 }
}
