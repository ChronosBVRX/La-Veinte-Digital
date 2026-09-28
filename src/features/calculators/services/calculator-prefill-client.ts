import {
  isCalculatorPrefillResponse,
  type CalculatorId,
  type CalculatorPrefillResponse,
} from "@/shared/contracts/calculator-prefill"

interface PrefillCacheEntry {
  data: CalculatorPrefillResponse
  cachedAtMs: number
}

const PREFILL_TTL_MS = 120_000 // 2 minutos en memoria por sesión
const prefillMemoryCache = new Map<string, PrefillCacheEntry>()
const inFlightRequests = new Map<string, Promise<CalculatorPrefillResponse | null>>()
let invalidationListenersBound = false

function getCacheKey(calculatorId: CalculatorId, targetDate: string): string {
  return `${calculatorId}::${targetDate}`
}

/**
 * Limpia de inmediato la caché en memoria de prerrelleno de calculadoras.
 * Se invoca automáticamente ante `nomina_payslip_updated` y `nomina_profile_updated`
 * para garantizar que el usuario jamás vea importes desactualizados tras subir un tarjetón.
 */
export function clearCalculatorPrefillCache(): void {
  prefillMemoryCache.clear()
  inFlightRequests.clear()
}

function ensureInvalidationListeners(): void {
  if (invalidationListenersBound || typeof window === "undefined") return
  invalidationListenersBound = true
  const purge = () => clearCalculatorPrefillCache()
  window.addEventListener("nomina_payslip_updated", purge)
  window.addEventListener("nomina_profile_updated", purge)
}

async function fetchFromNetwork(
  calculatorId: CalculatorId,
  targetDate: string,
  key: string,
): Promise<CalculatorPrefillResponse | null> {
  try {
    const url = new URL("/api/calculator-prefill", window.location.origin)
    url.searchParams.set("calculator", calculatorId)
    url.searchParams.set("date", targetDate)

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    if (!res.ok) return null

    const body: unknown = await res.json()
    if (!isCalculatorPrefillResponse(body)) return null

    prefillMemoryCache.set(key, {
      data: body,
      cachedAtMs: Date.now(),
    })
    return body
  } catch {
    return null
  }
}

/**
 * Cliente de prerrelleno para las calculadoras con caché en memoria SWR e
 * invalidación instantánea por eventos de tarjetón/perfil.
 *
 * Llama al endpoint interno /api/calculator-prefill y devuelve null ante
 * cualquier fallo (401, 400, 404, 500, red o respuesta inválida). Nunca
 * lanza errores que rompan la pantalla de la calculadora.
 */
export async function fetchCalculatorPrefill(
  calculatorId: CalculatorId,
  targetDate: string,
  options?: { forceRefresh?: boolean },
): Promise<CalculatorPrefillResponse | null> {
  ensureInvalidationListeners()
  const key = getCacheKey(calculatorId, targetDate)

  if (options?.forceRefresh) {
    prefillMemoryCache.delete(key)
  } else {
    const existing = prefillMemoryCache.get(key)
    if (existing && Date.now() - existing.cachedAtMs < PREFILL_TTL_MS) {
      return existing.data
    }
  }

  const pending = inFlightRequests.get(key)
  if (pending) return pending

  const promise = fetchFromNetwork(calculatorId, targetDate, key).finally(() => {
    inFlightRequests.delete(key)
  })
  inFlightRequests.set(key, promise)
  return promise
}
