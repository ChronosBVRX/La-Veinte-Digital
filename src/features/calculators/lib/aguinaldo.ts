import type { BaseConceptosInput, AguinaldoResult, FormulaEvidence } from "./types"

/**
 * Factor de aguinaldo utilizado actualmente por la aplicación de referencia.
 * NO tiene trazabilidad documental localizable en el repo: se conserva
 * intacto (no se sustituye por otro número mágico) pero se declara como
 * `app_reconstructed`. La alternativa documentada (Cláusula 107: 3 meses de
 * sueldo nominal, factor 6) se entrega como dato de comparación con
 * `pendingValidation`.
 */
export const FACTOR_AGUINALDO = 7.490956567109524

/** Factor documental de la Cláusula 107: 3 meses de sueldo nominal = base × 6. */
export const FACTOR_AGUINALDO_CLAUSULA_107 = 6

const FORMULA_EVIDENCE: FormulaEvidence = {
  status: "app_reconstructed",
  source: "Aplicación de referencia",
  reference: "Factor 7.490956567109524 (sin trazabilidad documental en el repo)",
  notes:
    "La Cláusula 107 del CCT (3 meses de sueldo nominal) implicaría un factor de 6 sobre la base quincenal. Este factor queda pendiente de validación contra tarjetones reales. NO se sustituye el factor reconstruido sin evidencia.",
}

export function calculateAguinaldo(input: BaseConceptosInput): AguinaldoResult {
  const base = input.concepto002 + input.concepto011
  const total = base * FACTOR_AGUINALDO
  const documentedTotal = base * FACTOR_AGUINALDO_CLAUSULA_107

  return {
    base,
    factor: FACTOR_AGUINALDO,
    total,
    anticipoEnero047: total / 6,
    anticipoAgosto043: total / 3,
    restoDiciembre049: total / 2,
    formulaEvidence: FORMULA_EVIDENCE,
    documentedAlternative: {
      label: "Cláusula 107 (3 meses de sueldo nominal)",
      factor: FACTOR_AGUINALDO_CLAUSULA_107,
      total: documentedTotal,
      reference: "CCT 2025-2027 — Cláusula 107 (aguinaldo)",
      pendingValidation: true,
    },
  }
}

export { FORMULA_EVIDENCE as AGUINALDO_FORMULA_EVIDENCE }
