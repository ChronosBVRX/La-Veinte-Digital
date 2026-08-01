import { isCalculatorId, isIsoDateString, type CalculatorId } from "@/shared/contracts/calculator-prefill"
import { todayForQueryParam } from "@/shared/lib/dates"

/**
 * Validación de la query de GET /api/calculator-prefill.
 * Mantiene la ruta delgada y permite probar los casos 400 sin servidor.
 *
 * Parámetro canónico: `targetDate`. El parámetro `date` se acepta solo como
 * legado temporal y queda documentado como tal.
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
  rawTargetDate: string | null = null,
): CalculatorPrefillQueryResult {
  if (!isCalculatorId(rawCalculator)) {
    return { ok: false, error: "Calculadora inválida" }
  }

  const legacyDate = rawDate !== null ? rawDate : null
  const targetDate = rawTargetDate ?? legacyDate ?? todayForQueryParam()
  if (!isIsoDateString(targetDate)) {
    return { ok: false, error: "Fecha inválida (formato YYYY-MM-DD)" }
  }

  return {
    ok: true,
    value: { calculatorId: rawCalculator, targetDate },
  }
}
