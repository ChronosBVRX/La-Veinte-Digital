import type { VacationPaymentEstimate, VacationRegime } from "./types"
import { getCctCulturalHelpDays, getRadiationCulturalHelpDays } from "./entitlement"

export interface PaymentCalculationParams {
  integratedMonthlySalary: number | null
  daysOrUnits: number
  seniorityYears: number
  radiologicalExposure?: boolean | "UNSURE"
  mark?: number
  regime?: VacationRegime
  fraction?: "FIRST" | "SECOND" | "SINGLE"
  sourcePayslipPeriod?: string
  isReconstructed?: boolean
  isV20?: boolean
}

/**
 * Calcula el pago estimado de vacaciones (Prima Vacacional 029 y Ayuda Cultural 048).
 *
 * Utiliza precisión completa en aritmética interna y redondea a 2 decimales
 * únicamente en el resultado monetario final.
 */
export function calculateVacationPayment(params: PaymentCalculationParams): VacationPaymentEstimate {
  const {
    integratedMonthlySalary,
    daysOrUnits,
    seniorityYears,
    radiologicalExposure,
    mark = 0,
    regime = "SEMESTRAL",
    sourcePayslipPeriod,
    isReconstructed = false,
    isV20 = false,
  } = params

  const warnings: string[] = []

  if (
    integratedMonthlySalary === null ||
    integratedMonthlySalary === undefined ||
    !Number.isFinite(integratedMonthlySalary) ||
    integratedMonthlySalary <= 0
  ) {
    return {
      integratedMonthlySalary: null,
      dailyIntegratedSalary: null,
      premium029: null,
      culturalHelp048: null,
      otherVacationPayment: null,
      grossVacationExtra: null,
      helpPaymentFraction: 0,
      confidence: "INCOMPLETE",
      sourcePayslipPeriod,
      warnings: ["No encontramos completo tu Sueldo Mensual Integrado. Revisa tu tarjetón para poder calcular cuánto cobrarías."],
    }
  }

  // Precisión aritmética completa: Salario Diario Integrado = SMI / 30
  const dailyIntegratedSalaryExact = integratedMonthlySalary / 30
  const dailyIntegratedSalary = Math.round(dailyIntegratedSalaryExact * 100) / 100

  // 1. Prima vacacional (concepto 029): Salario Diario x Días disfrutados x 25%
  const payableDays = Math.max(0, daysOrUnits)
  const premium029Exact = dailyIntegratedSalaryExact * payableDays * 0.25
  const premium029 = Math.round(premium029Exact * 100) / 100

  // 2. Ayuda para actividades culturales y recreativas (concepto 048):
  // Días según CCT Cláusula 47 (antigüedad efectiva) x Salario Diario x proporción de la marca
  let helpDays = 0
  if (!isV20) {
    if (regime === "CUATRIMESTRAL" || radiologicalExposure === true) {
      helpDays = getRadiationCulturalHelpDays(seniorityYears)
    } else {
      helpDays = getCctCulturalHelpDays(seniorityYears)
    }
  }

  let helpPaymentFraction: 0 | 0.5 | 1 = 0

  if (isV20) {
    // El periodo extraordinario V20 genera prima vacacional de sus días pero no ayuda 048
    helpPaymentFraction = 0
  } else if (regime === "CUATRIMESTRAL") {
    // En régimen cuatrimestral: marca 0 paga completa la ayuda correspondiente a este periodo
    if (mark === 0) {
      helpPaymentFraction = 1
    } else if (mark === 2) {
      helpPaymentFraction = 0
      warnings.push("Esta opción cuatrimestral no liquida la ayuda cultural 048.")
    } else if (mark === 5) {
      helpPaymentFraction = 0
    }
  } else {
    // Régimen SEMESTRAL / ESTATUTO
    switch (mark) {
      case 1:
        helpPaymentFraction = 0.5
        warnings.push("Con la marca 1 divides la ayuda: recibes el 50% en este periodo y el otro 50% al programar la segunda fracción con otra marca 1.")
        break
      case 2:
        helpPaymentFraction = 0
        warnings.push("La secuencia 2→3 conserva un segundo periodo de descanso pero esta opción no paga la ayuda cultural 048.")
        break
      case 3:
        helpPaymentFraction = 0
        warnings.push("La marca 3 concluye la secuencia 2→3: cobras la prima de este periodo pero no incluye ayuda 048.")
        break
      case 4:
        helpPaymentFraction = 1
        warnings.push("Con la marca 4 cobras completa la ayuda 048 en este periodo.")
        break
      case 9:
        helpPaymentFraction = 0
        warnings.push("Con la marca 9 cobras la prima de este periodo. La ayuda 048 se cobra en el periodo con marca 4.")
        break
      case 0:
      default:
        helpPaymentFraction = 1
        break
    }
  }

  const culturalHelp048Exact = dailyIntegratedSalaryExact * helpDays * helpPaymentFraction
  const culturalHelp048 = Math.round(culturalHelp048Exact * 100) / 100

  const otherVacationPayment: number | null = 0
  const grossVacationExtra = Math.round((premium029 + culturalHelp048 + (otherVacationPayment || 0)) * 100) / 100

  return {
    integratedMonthlySalary: Math.round(integratedMonthlySalary * 100) / 100,
    dailyIntegratedSalary,
    premium029,
    culturalHelp048,
    helpDays: Math.round(helpDays * 10) / 10,
    otherVacationPayment,
    grossVacationExtra,
    helpPaymentFraction,
    confidence: isReconstructed ? "RECONSTRUCTED" : "CONFIRMED",
    sourcePayslipPeriod,
    warnings,
  }
}

/**
 * Suma los importes de varios periodos calculados.
 */
export function calculateAnnualTotals(estimates: (VacationPaymentEstimate | undefined | null)[]): {
  totalPremium029: number | null
  totalCulturalHelp048: number | null
  totalGrossVacationExtra: number | null
  allComplete: boolean
} {
  let hasIncomplete = false
  let sum029 = 0
  let sum048 = 0
  let sumGross = 0

  for (const est of estimates) {
    if (!est || est.confidence === "INCOMPLETE" || est.grossVacationExtra === null) {
      hasIncomplete = true
    } else {
      sum029 += est.premium029 ?? 0
      sum048 += est.culturalHelp048 ?? 0
      sumGross += est.grossVacationExtra ?? 0
    }
  }

  if (hasIncomplete && sumGross === 0) {
    return {
      totalPremium029: null,
      totalCulturalHelp048: null,
      totalGrossVacationExtra: null,
      allComplete: false,
    }
  }

  return {
    totalPremium029: Math.round(sum029 * 100) / 100,
    totalCulturalHelp048: Math.round(sum048 * 100) / 100,
    totalGrossVacationExtra: Math.round(sumGross * 100) / 100,
    allComplete: !hasIncomplete,
  }
}

/**
 * Formatea una cantidad en moneda mexicana (es-MX, MXN).
 */
export function formatMexicanCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "$—"
  }
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
