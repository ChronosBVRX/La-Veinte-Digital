import {
  isCalculatorPrefillResponse,
  type CalculatorId,
  type CalculatorPrefillResponse,
} from "@/shared/contracts/calculator-prefill"

/**
 * Cliente de prerrelleno para las calculadoras.
 *
 * Llama al endpoint interno /api/calculator-prefill y devuelve null ante
 * cualquier fallo (401, 400, 404, 500, red o respuesta inválida). Nunca
 * lanza errores que rompan la pantalla de la calculadora.
 */
export async function fetchCalculatorPrefill(
  calculatorId: CalculatorId,
  targetDate: string,
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
    return body
  } catch {
    return null
  }
}
