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

  const isV20Calculated = Boolean(isV20 || regime === "EXTRAORDINARIO_V20")

  // 1. Prima vacacional (concepto 029): Salario Diario x Días disfrutados x 25%
  // Nota: en V20 Marca 8 se pagan 15 días de prima 029 sin días de descanso presencial
  const payableDays = (isV20Calculated && mark === 8) ? 15 : Math.max(0, daysOrUnits)
  const premium029Exact = dailyIntegratedSalaryExact * payableDays * 0.25
  const premium029 = Math.round(premium029Exact * 100) / 100

  // 2. Ayuda para actividades culturales y recreativas (concepto 048):
  // Días según CCT Cláusula 47 (antigüedad efectiva) x Salario Diario x proporción de la marca
  let helpDays = 0
  let helpPaymentFraction: 0 | 0.5 | 1 = 0

  if (isV20Calculated) {
    // Cláusula 47 del CCT y Tabla de Marcas 1A74-022-065:
    // - Marca 0: 10 días de descanso + 10 días de salario por concepto 048
    // - Marca 6: 15 días de descanso continuo con prima 029, SIN ayuda cultural 048 (0 días)
    // - Marca 7: 30 días de salario por concepto 048 en efectivo (sin descanso ni prima 029)
    // - Marca 8: 15 días de prima 029 y 30 días de antigüedad para jubilación (sin concepto 048)
    switch (mark) {
      case 6:
        helpDays = 0
        helpPaymentFraction = 0
        break
      case 7:
        helpDays = 30
        helpPaymentFraction = 1
        break
      case 8:
        helpDays = 0
        helpPaymentFraction = 0
        break
      case 0:
      default:
        helpDays = 10
        helpPaymentFraction = 1
        break
    }
  } else if (regime === "CUATRIMESTRAL" || radiologicalExposure === true) {
    // Régimen CUATRIMESTRAL (exposición a radiaciones)
    helpDays = getRadiationCulturalHelpDays(seniorityYears)
    if (mark === 0) {
      helpPaymentFraction = 1
    } else if (mark === 2 || mark === 5) {
      // Modalidad B (Mayor Descanso): no liquida ayuda 048 a cambio de hasta 15 días hábiles de descanso por cuatrimestre
      helpPaymentFraction = 0
      warnings.push("Modalidad B (Mayor Descanso): Esta opción otorga hasta 15 días hábiles de descanso físico por cuatrimestre a cambio de no percibir la ayuda cultural 048.")
    }
  } else {
    // Régimen SEMESTRAL / ESTATUTO
    helpDays = getCctCulturalHelpDays(seniorityYears)
    switch (mark) {
      case 1:
        helpPaymentFraction = 0.5
        warnings.push("Con la marca 1 divides la ayuda: recibes el 50% en este periodo y el otro 50% al programar la segunda fracción con otra marca 1.")
        break
      case 2:
        helpPaymentFraction = 0
        warnings.push("Modalidad Mayor Descanso: Con Marca 2 disfrutas tu primer periodo. En el segundo periodo (Marca 3) disfrutas de hasta 15 días hábiles de descanso a cambio de no cobrar la ayuda cultural 048.")
        break
      case 3:
        helpPaymentFraction = 0
        warnings.push("Modalidad Mayor Descanso: Concluye la secuencia 2→3 con hasta 15 días hábiles de descanso físico. No incluye cobro de ayuda cultural 048.")
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

export interface VacationPaymentTimingEstimate {
  quincenaLabel: string
  estimatedPaymentDate: string
  civilDescription: string
}

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
]

/**
 * Estima la quincena y fecha de pago en la que el IMSS deposita las prestaciones
 * vacacionales (Prima 029 y Ayuda Cultural 048) conforme a la Cláusula 47 del CCT:
 * El pago se realiza con anticipación a la fecha en que el trabajador deba empezar a disfrutarlas.
 *
 * Regla de nómina IMSS:
 * - Si el rol inicia del 1 al 15 del mes M: se cubre en la 2.ª quincena del mes previo (aprox. último día del mes previo).
 * - Si el rol inicia del 16 en adelante del mes M: se cubre en la 1.ª quincena de ese mismo mes M (aprox. día 15 de ese mes).
 */
export function estimateVacationPaymentTiming(roleStartDate: string): VacationPaymentTimingEstimate {
  const parts = roleStartDate.split("-").map(Number)
  const year = parts[0]
  const month = parts[1] // 1-12
  const day = parts[2]

  if (!year || !month || !day) {
    return {
      quincenaLabel: "Quincena previa a tu rol",
      estimatedPaymentDate: "Fecha por confirmar",
      civilDescription: "Se deposita en la quincena previa al inicio de tu rol conforme a la Cláusula 47 del CCT.",
    }
  }

  if (day >= 16) {
    const monthName = MONTH_NAMES_ES[month - 1]
    return {
      quincenaLabel: `1.ª quincena de ${monthName} de ${year}`,
      estimatedPaymentDate: `15/${String(month).padStart(2, "0")}/${year}`,
      civilDescription: `Se te deposita en la 1.ª quincena de ${monthName} de ${year} (aprox. 15 de ${monthName}), con anticipación a tu salida conforme a la Cláusula 47 del CCT.`,
    }
  } else {
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = year - 1
    }
    const prevMonthName = MONTH_NAMES_ES[prevMonth - 1]
    const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
    return {
      quincenaLabel: `2.ª quincena de ${prevMonthName} de ${prevYear}`,
      estimatedPaymentDate: `${lastDayOfPrevMonth}/${String(prevMonth).padStart(2, "0")}/${prevYear}`,
      civilDescription: `Se te deposita en la 2.ª quincena de ${prevMonthName} de ${prevYear} (aprox. ${lastDayOfPrevMonth} de ${prevMonthName}), con anticipación a tu salida conforme a la Cláusula 47 del CCT.`,
    }
  }
}

