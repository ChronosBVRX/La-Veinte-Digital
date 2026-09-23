import { parseImssMoney } from "@/features/tarjeton/lib/money-parser"

/**
 * Estimación provisional del aumento salarial quincenal (convenio 2026 pendiente).
 *
 * Supuestos (NO definitivos, solo estimación):
 * - Sueldo tabular (002) o sueldo sustituto (008): +2.9% (tasa 0.029).
 * - Concepto 11: coeficiente nuevo 86.05% (0.8605) del tabular ya aumentado
 *   como supuesto preliminar documentado (texto vigente Cláusula 63 Bis: 82.15% / 0.8215,
 *   con incremento estimado de +3.9 puntos porcentuales).
 * - La Cláusula 157 NO forma parte de este cálculo: no es percepción
 *   quincenal directa. Esta función ni siquiera la recibe como parámetro y se excluye.
 * - No se multiplica el total del tarjetón por 8.55%.
 * - Vigencia desde el 16 de octubre de 2026 (quincena 20 / 2A-OCT-2026): si el tarjetón
 *   activo ya incorpora el nuevo tabulador (fecha/periodo >= 16 oct 2026), no se aplica
 *   nuevamente el aumento y se marca como `post-cutoff`.
 *
 * Función pura: recibe números (o cadenas monetarias con "$", comas,
 * espacios, normalizadas con parseImssMoney) y devuelve el resultado.
 * El único redondeo es el del aumento final a dos decimales.
 */

export const SALARY_ESTIMATE_TABULAR_INCREASE_RATE = 0.029
/** Hipótesis preliminar de estimación (+3.9 pp sobre el factor contractual vigente). */
export const SALARY_ESTIMATE_CONCEPT11_COEFFICIENT = 0.8605
/** Coeficiente contractual vigente de la Cláusula 63 Bis (82.15%). */
export const CLAUSULA_63_BIS_COEF_VIGENTE = 0.8215

export type SalaryBaseType = "base" | "substitute" | "mixed" | "none"
export type SubstituteCoverageType = "partial_confirmed" | "unknown"

export type SalaryEstimateStatus =
  | "ok"
  | "missing-payslip"
  | "missing-tabular"
  | "missing-concept11"
  | "insufficient-data"
  | "new-schedule-unverified"
  | "unverified-comparable-base"
  | "invalid"

export interface SalaryEstimateInput {
  tabular?: unknown
  substituteSalary?: unknown
  salaryType?: SalaryBaseType
  concept11: unknown
  hasPayslip: boolean
  isPostCutoff?: boolean
  hasAmbiguousCoverages?: boolean
  substituteCoverage?: SubstituteCoverageType
  daysPaid?: number
}

export interface SalaryEstimateResult {
  currentTabular: number
  currentConcept11: number
  estimatedTabular: number
  estimatedConcept11: number
  estimatedFortnightlyIncrease: number
  calculationStatus: SalaryEstimateStatus
  salaryType: SalaryBaseType
  isPostCutoff: boolean
  isPartialCoverage?: boolean
  substituteCoverage?: SubstituteCoverageType
  daysPaid?: number
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

const EMPTY_RESULT = (
  status: SalaryEstimateStatus,
  salaryType: SalaryBaseType = "none",
): SalaryEstimateResult => ({
  currentTabular: 0,
  currentConcept11: 0,
  estimatedTabular: 0,
  estimatedConcept11: 0,
  estimatedFortnightlyIncrease: 0,
  calculationStatus: status,
  salaryType,
  isPostCutoff: false,
  isPartialCoverage: salaryType === "substitute",
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

  const isSubstitute =
    input.salaryType === "substitute" ||
    (input.substituteSalary !== undefined && input.tabular === undefined)
  const salaryType: SalaryBaseType = input.salaryType ?? (isSubstitute ? "substitute" : "base")

  if (input.isPostCutoff) {
    const rawBase = isSubstitute ? input.substituteSalary : input.tabular
    const base = normalizeAmount(rawBase) ?? 0
    const concept11 = normalizeAmount(input.concept11) ?? 0
    return {
      currentTabular: base,
      currentConcept11: concept11,
      estimatedTabular: base,
      estimatedConcept11: concept11,
      estimatedFortnightlyIncrease: 0,
      calculationStatus: "new-schedule-unverified",
      salaryType,
      isPostCutoff: true,
      isPartialCoverage: isSubstitute,
      substituteCoverage: input.substituteCoverage ?? "unknown",
      daysPaid: input.daysPaid,
    }
  }

  if (input.hasAmbiguousCoverages || input.salaryType === "mixed") {
    return EMPTY_RESULT("insufficient-data", "mixed")
  }

  const rawBase = isSubstitute ? input.substituteSalary : input.tabular
  const tabular = normalizeAmount(rawBase)
  if (tabular === undefined) return EMPTY_RESULT("missing-tabular", salaryType)
  if (!(tabular > 0)) return EMPTY_RESULT("invalid", salaryType)

  const concept11 = normalizeAmount(input.concept11)
  if (concept11 === undefined) return EMPTY_RESULT("missing-concept11", salaryType)
  if (!(concept11 >= 0)) return EMPTY_RESULT("invalid", salaryType)

  // Tratamiento de Concepto 011 = 0:
  // Se conserva como dato real del recibo (currentConcept11 = 0), pero se marca la
  // estimación como pendiente de comprobar al no existir una base comparable
  // acreditada. No se muestra el incremento calculado desde cero como aumento esperado.
  if (concept11 === 0) {
    return {
      currentTabular: tabular,
      currentConcept11: 0,
      estimatedTabular: roundFinalIncrease(tabular * (1 + SALARY_ESTIMATE_TABULAR_INCREASE_RATE)),
      estimatedConcept11: 0,
      estimatedFortnightlyIncrease: 0,
      calculationStatus: "unverified-comparable-base",
      salaryType,
      isPostCutoff: false,
      isPartialCoverage: isSubstitute,
      substituteCoverage: isSubstitute ? (input.substituteCoverage ?? "unknown") : undefined,
      daysPaid: input.daysPaid,
    }
  }

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
    salaryType,
    isPostCutoff: false,
    isPartialCoverage: isSubstitute,
    substituteCoverage: isSubstitute ? (input.substituteCoverage ?? "unknown") : undefined,
    daysPaid: input.daysPaid,
  }
}
