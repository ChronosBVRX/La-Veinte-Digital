import type { BaseConceptosInput, Clausula97Result } from "./types"

export function calculateClausula97(input: BaseConceptosInput): Clausula97Result {
  const baseQuincenal = input.concepto002 + input.concepto011

  return {
    baseQuincenal,
    unMes: baseQuincenal * 2,
    dosMeses: baseQuincenal * 4,
    tresMeses: baseQuincenal * 6,
    cuatroMeses: baseQuincenal * 8,
  }
}
