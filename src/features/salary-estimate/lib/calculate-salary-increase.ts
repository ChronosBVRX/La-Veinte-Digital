import { parseImssMoney } from "@/features/tarjeton/lib/money-parser"

/**
 * Estimación provisional del aumento salarial quincenal (convenio 2026 pendiente).
 *
 * Supuestos (NO definitivos, solo estimación):
 * - Sueldo tabular: +2.9%.
 * - Concepto 11: coeficiente nuevo 86.05% del tabular ya aumentado
 *   (82.15% vigente + 3.9 puntos porcentuales).
 * - La Cláusula 157 NO forma parte de este cálculo: no es percepción
 *   quincenal directa. Esta función ni siquiera la recibe como parámetro.
 *
 * Función pura: recibe números (o cadenas monetarias con "$", comas,
 * espacios, normalizadas con parseImssMoney) y devuelve el resultado.
 * El único redondeo es el del aumento final a dos decimales.
 */

export const SALARY_ESTIMATE_TABULAR_INCREASE_RATE = 0.029
export const SALARY_ESTIMATE_CONCEPT11_COEFFICIENT = 0.8605

export type SalaryEstimateStatus =
  | "ok"
  | "missing-payslip"
  | "missing-tabular"
  | "missing-concept11"
  | "invalid"

export interface SalaryEstimateInput {
  tabular: unknown
  concept11: unknown
  hasPayslip: boolean
}

export interface SalaryEstimateResult {
  currentTabular: number
  currentConcept11: number
  estimatedTabular: number
  estimatedConcept11: number
  estimatedFortnightlyIncrease: number
  calculationStatus: SalaryEstimateStatus
}

/**
 * Redondeo final a centavos con corrección de polvo binario.
 *
 * Los importes tienen como máximo 2 decimales y los productos intermedios
 * no acumulan más de 6 decimales significativos; `toFixed(10)` elimina el
 * ruido de representación (p. ej. 8854.545 → 8854.544999999999) sin tocar
 * el valor decimal real, y el redondeo a 2 decimales se aplica una sola
 * vez sobre el aumento final.
 */
function roundFinalIncrease(value: number): number {
  return Math.round(Number(value.toFixed(10)) * 100) / 100
}

const EMPTY_RESULT = (status: SalaryEstimateStatus): SalaryEstimateResult => ({
  currentTabular: 0,
  currentConcept11: 0,
  estimatedTabular: 0,
  estimatedConcept11: 0,
  estimatedFortnightlyIncrease: 0,
  calculationStatus: status,
})

function normalizeAmount(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : undefined
  }
  if (typeof raw === "string") {
    return parseImssMoney(raw)
  }
  return undefined
}

export function calculateSalaryIncrease(input: SalaryEstimateInput): SalaryEstimateResult {
  if (!input.hasPayslip) return EMPTY_RESULT("missing-payslip")

  const tabular = normalizeAmount(input.tabular)
  if (tabular === undefined) return EMPTY_RESULT("missing-tabular")
  if (!(tabular > 0)) return EMPTY_RESULT("invalid")

  const concept11 = normalizeAmount(input.concept11)
  if (concept11 === undefined) return EMPTY_RESULT("missing-concept11")
  if (!(concept11 >= 0)) return EMPTY_RESULT("invalid")

  const estimatedTabular = tabular * (1 + SALARY_ESTIMATE_TABULAR_INCREASE_RATE)
  const estimatedConcept11 = estimatedTabular * SALARY_ESTIMATE_CONCEPT11_COEFFICIENT
  const estimatedFortnightlyIncrease = roundFinalIncrease(
    estimatedTabular + estimatedConcept11 - tabular - concept11,
  )

  return {
    currentTabular: tabular,
    currentConcept11: concept11,
    estimatedTabular,
    estimatedConcept11,
    estimatedFortnightlyIncrease,
    calculationStatus: "ok",
  }
}
