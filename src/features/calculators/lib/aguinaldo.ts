import type { BaseConceptosInput, AguinaldoResult } from "./types"

const FACTOR_AGUINALDO = 7.490956567109524

export function calculateAguinaldo(input: BaseConceptosInput): AguinaldoResult {
  const base = input.concepto002 + input.concepto011
  const total = base * FACTOR_AGUINALDO

  return {
    base,
    total,
    anticipoEnero047: total / 6,
    anticipoAgosto043: total / 3,
    restoDiciembre049: total / 2,
  }
}
