import { isCalculatorId, isIsoDateString, type CalculatorId } from "@/shared/contracts/calculator-prefill"

/**
 * Validación de la query de GET /api/calculator-prefill.
 * Mantiene la ruta delgada y permite probar los casos 400 sin servidor.
 */

export interface CalculatorPrefillQuery {
  calculatorId: CalculatorId
  targetDate: string
}

export type CalculatorPrefillQueryResult =
  | { ok: true; value: CalculatorPrefillQuery }
  | { ok: false; error: string }

export function parseCalculatorPrefillQuery(
  rawCalculator: string | null,
  rawDate: string | null,
): CalculatorPrefillQueryResult {
  if (!isCalculatorId(rawCalculator)) {
    return { ok: false, error: "Calculadora inválida" }
  }

  const targetDate = rawDate ?? new Date().toISOString().slice(0, 10)
  if (!isIsoDateString(targetDate)) {
    return { ok: false, error: "Fecha inválida (formato YYYY-MM-DD)" }
  }

  return {
    ok: true,
    value: { calculatorId: rawCalculator, targetDate },
  }
}
