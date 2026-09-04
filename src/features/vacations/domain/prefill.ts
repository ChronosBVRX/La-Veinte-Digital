/**
 * Módulo de dominio para la precarga del simulador de vacaciones.
 *
 * Convierte el WorkerContext canónico al estado inicial del simulador,
 * aplicando la precedencia estricta de fuentes:
 *   1. profiles (datos personales y adscripción general)
 *   2. payroll_contexts (categoría, tipo de contratación, antigüedad efectiva)
 *   3. imported_payslips (último tarjetón: empleado y bloque vacations)
 *   4. vacation_profile_data (datos especializados complementarios)
 *
 * Sin I/O ni efectos secundarios: función pura y testeable.
 */
import type { WorkerContext } from "@/shared/server/worker-context-builder"
import type {
  ContractType,
  EffectiveSeniority,
  VacationEntitlement,
  VacationRegime,
  WorkerProfile,
  WorkScheduleType,
} from "./types"
import { determineVacationRegime } from "./entitlement"
import { getCompatibleInclusionMarks } from "./continuity"
import { parseImssPayslipSeniority } from "@/features/tarjeton/lib/imss-seniority-parser"
import { parsePorVencerDate } from "@/features/tarjeton/lib/imss-date-parser"
import { addCivilMonths, normalizeCivilDate } from "./role-eligibility"

export interface PrefilledVacationState {
  profile: WorkerProfile
  continuityMark: number
  nextPeriodNumber: number
  dueDate: string
  expiredVacationPeriods: number
  enjoyedVacationDays: number
  totalYearVacationDays: number
  periodToEnjoy: number
  regime: VacationRegime
  selectedInclusionMark: number
  selectedStartDate: string
  entitlements: VacationEntitlement[]
  warnings: string[]
  provenance: {
    sourceDescription: string
    hasLatestPayslip: boolean
    hasProfile: boolean
    hasEmployment: boolean
    hasVacationProfile: boolean
    periodLabel: string | null
    isPorVencerMissingFromPayslip: boolean
  }
}

/**
 * Interpreta antigüedad desde múltiples formatos:
 * - "14 años 3 qnas 1 días"
 * - "14 años"
 * - "14.5"
 * - Objeto { years, fortnights, days } o { years, months, days }
 * - Cálculo a partir de fecha efectiva de antigüedad
 */
export function parseSeniorityFromAny(
  raw: unknown,
  effectiveSeniorityDate?: string | null,
  referenceDateStr?: string
): EffectiveSeniority {
  // 1. Si viene como objeto
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (typeof obj.years === "number") {
      const fortnights = typeof obj.fortnights === "number"
        ? obj.fortnights
        : typeof obj.months === "number"
          ? obj.months * 2
          : 0
      const days = typeof obj.days === "number" ? obj.days : 0
      return {
        years: obj.years,
        fortnights,
        days,
        precision: "EXACT",
      }
    }
  }

  // 2. Si viene como texto
  if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim()

    // Formato tarjetón: "14 años 3 qnas 1 días"
    const parsedImss = parseImssPayslipSeniority(text)
    if (parsedImss) {
      return {
        years: parsedImss.years,
        fortnights: parsedImss.fortnights,
        days: parsedImss.days,
        precision: "FROM_TARJETON",
      }
    }

    // Número directo como texto: "14" o "14 años"
    const simpleMatch = text.match(/^(\d+)(?:\s*(?:años?|anios?|a))?$/i)
    if (simpleMatch) {
      return {
        years: Number(simpleMatch[1]),
        fortnights: 0,
        days: 0,
        precision: "APPROXIMATE",
      }
    }

    // Decimal: "14.5"
    const decimalMatch = text.match(/^(\d+(?:\.\d+)?)$/)
    if (decimalMatch) {
      const val = parseFloat(decimalMatch[1])
      const years = Math.floor(val)
      const fraction = val - years
      const fortnights = Math.round(fraction * 24)
      return {
        years,
        fortnights,
        days: 0,
        precision: "APPROXIMATE",
      }
    }
  }

  // 3. Número directo
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return {
      years: Math.floor(raw),
      fortnights: 0,
      days: 0,
      precision: "APPROXIMATE",
    }
  }

  // 4. Cálculo a partir de fecha efectiva de antigüedad
  if (effectiveSeniorityDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveSeniorityDate)) {
    const ref = referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)
      ? referenceDateStr
      : new Date().toISOString().slice(0, 10)

    const [ey, em, ed] = effectiveSeniorityDate.split("-").map(Number)
    const [ry, rm, rd] = ref.split("-").map(Number)

    let years = ry - ey
    let months = rm - em
    let days = rd - ed

    if (days < 0) {
      months--
      days += 30
    }
    if (months < 0) {
      years--
      months += 12
    }

    if (years >= 0) {
      return {
        years,
        fortnights: months * 2 + (days >= 15 ? 1 : 0),
        days: days % 15,
        precision: "CALCULATED",
      }
    }
  }

  return {
    years: 0,
    fortnights: 0,
    days: 0,
    precision: "APPROXIMATE",
  }
}

/**
 * Normaliza el tipo de contratación a los permitidos por el sistema.
 */
export function normalizeContractType(raw: string | null | undefined): ContractType {
  if (!raw) return "BASE"
  const upper = raw.trim().toUpperCase().replace(/[\s\-]/g, "_")
  if (upper.includes("CONFIANZA_A") || upper.includes("ESTATUTO")) return "CONFIANZA_A_ESTATUTO"
  if (upper.includes("CONFIANZA_B")) return "CONFIANZA_B"
  if (upper === "CONFIANZA") return "CONFIANZA"
  if (upper.includes("TEMPORAL")) return "TEMPORAL"
  if (upper.includes("SUSTITUTO")) return "SUSTITUTO"
  if (upper.includes("RESIDENTE")) return "MEDICO_RESIDENTE"
  if (upper.includes("BECADO")) return "BECADO"
  if (upper.includes("BASE")) return "BASE"
  return "BASE"
}

/**
 * Identifica si un periodo corresponde al régimen extraordinario V20.
 * Acepta numeraciones >= 220 o claves que incluyan "V20" / "V-20" o días de 20 años en tarjetón.
 */
export function isV20Period(
  periodNumber: number | null | undefined,
  periodIdentifier?: string | null,
  twentyYearsOrMoreDays?: number | null
): boolean {
  if (typeof periodNumber === "number" && periodNumber >= 220) return true
  if (typeof twentyYearsOrMoreDays === "number" && twentyYearsOrMoreDays > 0) return true
  if (typeof periodIdentifier === "string" && /\bV-?20\b/i.test(periodIdentifier)) return true
  return false
}

/**
 * Convierte el WorkerContext en el estado inicial para el asistente de vacaciones.
 */
export function prefillVacationSimulator(context: WorkerContext | null | undefined): PrefilledVacationState {
  const warnings: string[] = []

  const profileRow = context?.profile ?? null
  const employmentRow = context?.employment ?? null
  const vacationsRow = context?.vacations ?? null
  const vacProfileRow = context?.vacationProfile ?? null
  const payrollRow = context?.payroll ?? null

  const hasProfile = Boolean(profileRow)
  const hasEmployment = Boolean(employmentRow)
  const hasLatestPayslip = Boolean(vacationsRow || payrollRow?.latestPeriod)
  const hasVacationProfile = Boolean(vacProfileRow)

  // 1. Contratación
  const contractType = normalizeContractType(
    employmentRow?.employmentType ??
    vacProfileRow?.contractType ??
    null
  )

  // 2. Antigüedad
  let effectiveSeniority: EffectiveSeniority = { years: 0, fortnights: 0, days: 0, precision: "APPROXIMATE" }
  if (employmentRow?.seniorityRaw) {
    effectiveSeniority = parseSeniorityFromAny(employmentRow.seniorityRaw, employmentRow.effectiveSeniorityDate)
  } else if (vacProfileRow?.effectiveSeniorityYears !== null && vacProfileRow?.effectiveSeniorityYears !== undefined) {
    effectiveSeniority = {
      years: vacProfileRow.effectiveSeniorityYears,
      fortnights: vacProfileRow.effectiveSeniorityFortnights ?? 0,
      days: vacProfileRow.effectiveSeniorityDays ?? 0,
      precision: "EXACT",
    }
  } else if (employmentRow?.effectiveSeniorityDate) {
    effectiveSeniority = parseSeniorityFromAny(null, employmentRow.effectiveSeniorityDate)
  } else if (profileRow?.antiguedad) {
    effectiveSeniority = parseSeniorityFromAny(profileRow.antiguedad)
  } else {
    warnings.push("No se encontró antigüedad registrada en tu perfil. Puedes verificarla o capturarla en el asistente.")
  }

  // 3. Descansos semanales
  const weeklyRestDays = (
    vacProfileRow?.weeklyRestDays && Array.isArray(vacProfileRow.weeklyRestDays) && vacProfileRow.weeklyRestDays.length > 0
  )
    ? vacProfileRow.weeklyRestDays
    : (employmentRow?.weeklyRestDays && Array.isArray(employmentRow.weeklyRestDays) && employmentRow.weeklyRestDays.length > 0)
      ? employmentRow.weeklyRestDays
      : [5, 6]

  // 4. Radiación
  const radiologicalExposure = (
    employmentRow?.radiologicalExposure !== null && employmentRow?.radiologicalExposure !== undefined
  )
    ? employmentRow.radiologicalExposure
    : vacProfileRow?.radiologicalExposure === "YES"
      ? true
      : vacProfileRow?.radiologicalExposure === "NO"
        ? false
        : vacProfileRow?.radiologicalExposure === "UNSURE"
          ? "UNSURE"
          : false

  // 5. Horario de trabajo
  const workScheduleType: WorkScheduleType = (vacProfileRow?.workScheduleType as WorkScheduleType) ?? "ORDINARY"

  // 6. Contrato temporal y fecha de fin
  const contractEndDate = employmentRow?.contractEndDate ?? vacProfileRow?.contractEndDate ?? undefined
  if ((contractType === "TEMPORAL" || contractType === "SUSTITUTO") && !contractEndDate) {
    warnings.push("Para contratos temporales o sustitutos, es necesario registrar la fecha de fin de contrato.")
  }

  // 7. Ensamblar WorkerProfile
  const profile: WorkerProfile = {
    fullName: profileRow?.fullName ?? undefined,
    matricula: profileRow?.matricula ?? undefined,
    contractType,
    category: employmentRow?.categoryName ?? profileRow?.categoria ?? undefined,
    categoryCode: employmentRow?.categoryCode ?? undefined,
    workScheduleType,
    shift: employmentRow?.shift ?? vacProfileRow?.shift ?? undefined,
    adscription: employmentRow?.adscripcion ?? profileRow?.adscripcion ?? undefined,
    unit: vacProfileRow?.unit ?? undefined,
    service: vacProfileRow?.service ?? undefined,
    entryDate: employmentRow?.entryDate ?? vacProfileRow?.entryDate ?? undefined,
    effectiveSeniority,
    radiologicalExposure,
    weeklyRestDays,
    contractEndDate,
  }

  // 8. Datos del tarjetón y vacaciones
  const continuityMark = typeof vacationsRow?.continuityMark === "number" ? vacationsRow.continuityMark : 0
  const nextPeriodNumber = typeof vacationsRow?.periodNumberToEnjoy === "number" ? vacationsRow.periodNumberToEnjoy : 1
  const periodToEnjoy = nextPeriodNumber
  const expiredVacationPeriods = typeof vacationsRow?.expiredPeriods === "number" ? vacationsRow.expiredPeriods : 0
  const enjoyedVacationDays = typeof vacationsRow?.enjoyedDays === "number" ? vacationsRow.enjoyedDays : 0
  const totalYearVacationDays = typeof vacationsRow?.daysInYear === "number" ? vacationsRow.daysInYear : 0

  // 9. Fecha "Por vencer"
  let dueDate = ""
  let isPorVencerMissingFromPayslip = false
  const directDue = vacationsRow?.porVencer || vacationsRow?.dueDate
  if (directDue) {
    dueDate = normalizeCivilDate(directDue) || parsePorVencerDate(directDue) || directDue
  } else if (vacationsRow?.porVencerRaw) {
    const recovered = parsePorVencerDate(vacationsRow.porVencerRaw) || normalizeCivilDate(vacationsRow.porVencerRaw)
    if (recovered) {
      dueDate = recovered
    }
  }

  if (!dueDate) {
    if (hasLatestPayslip && vacationsRow) {
      isPorVencerMissingFromPayslip = true
      warnings.push("Tu tarjetón no tiene la fecha 'Por vencer' persistida. Reimporta tu tarjetón una sola vez para recuperarla automáticamente, o captúrala directamente.")
    }
  }

  // 10. Régimen
  const isV20 = isV20Period(nextPeriodNumber, null, vacationsRow?.twentyYearsOrMoreDays)
  const regime = determineVacationRegime(
    contractType,
    effectiveSeniority.years,
    radiologicalExposure,
    isV20
  )

  // 11. Marca de inclusión por defecto
  const compatibleMarks = getCompatibleInclusionMarks(regime, continuityMark)
  const selectedInclusionMark = compatibleMarks.length > 0 ? compatibleMarks[0] : 0

  // 12. Periodo del tarjetón
  const periodLabel = payrollRow?.latestPeriod ?? null

  // 13. Derechos vacacionales estructurados por periodo
  let entitlements: VacationEntitlement[] = []
  if (vacationsRow?.entitlements && Array.isArray(vacationsRow.entitlements) && vacationsRow.entitlements.length > 0) {
    entitlements = vacationsRow.entitlements.map((ent, idx) => {
      let entDue = ent.dueDate ? (normalizeCivilDate(ent.dueDate) || ent.dueDate) : null
      let entConf = ent.dueDateConfidence
      let entSrc = ent.dueDateSource

      // Si periodos posteriores vienen sin dueDate pero tenemos dueDate en el periodo 1:
      if (!entDue && dueDate && idx > 0) {
        const monthsToAdd = regime === "CUATRIMESTRAL" ? idx * 4 : idx * 6
        entDue = addCivilMonths(dueDate, monthsToAdd)
        entConf = "PROVISIONAL"
        entSrc = "PROJECTED"
      }

      return {
        ...ent,
        dueDate: entDue,
        dueDateConfidence: entConf || (entDue ? "CONFIRMED" : "UNKNOWN"),
        dueDateSource: entSrc || (entDue ? "TARJETON" : "MISSING"),
      }
    })
  } else {
    const workerRegime = regime === "CUATRIMESTRAL" ? "CUATRIMESTRAL" : "SEMESTRAL"
    entitlements.push({
      id: "ord-1",
      sequence: 1,
      regime: workerRegime,
      entitlementKind: "ORDINARY",
      kind: "ORDINARY",
      periodNumber: 1,
      dueDate: dueDate || null,
      dueDateSource: dueDate ? "TARJETON" : "MISSING",
      dueDateConfidence: dueDate ? "CONFIRMED" : "UNKNOWN",
      sourcePayslipPeriod: periodLabel ?? "",
      confirmed: Boolean(dueDate),
    })

    const secondRaw = typeof vacationsRow?.secondPeriodStartRaw === "string" ? vacationsRow.secondPeriodStartRaw : null
    const secondParsed = secondRaw ? (normalizeCivilDate(secondRaw) || secondRaw) : null
    const projectedSecond = (!secondParsed && dueDate)
      ? addCivilMonths(dueDate, regime === "CUATRIMESTRAL" ? 4 : 6)
      : null

    entitlements.push({
      id: "ord-2",
      sequence: 2,
      regime: workerRegime,
      entitlementKind: "ORDINARY",
      kind: "ORDINARY",
      periodNumber: 2,
      dueDate: secondParsed ?? projectedSecond,
      dueDateSource: secondParsed ? "TARJETON" : projectedSecond ? "PROJECTED" : "MISSING",
      dueDateConfidence: secondParsed ? "CONFIRMED" : projectedSecond ? "PROVISIONAL" : "UNKNOWN",
      sourcePayslipPeriod: periodLabel ?? "",
      confirmed: Boolean(secondParsed),
    })

    if (regime === "CUATRIMESTRAL") {
      const projectedThird = dueDate ? addCivilMonths(dueDate, 8) : null
      entitlements.push({
        id: "ord-3",
        sequence: 3,
        regime: "CUATRIMESTRAL",
        entitlementKind: "ORDINARY",
        kind: "ORDINARY",
        periodNumber: 3,
        dueDate: projectedThird,
        dueDateSource: projectedThird ? "PROJECTED" : "MISSING",
        dueDateConfidence: projectedThird ? "PROVISIONAL" : "UNKNOWN",
        sourcePayslipPeriod: periodLabel ?? "",
        confirmed: false,
      })
    }
    if (isV20) {
      entitlements.push({
        id: "v20",
        sequence: regime === "CUATRIMESTRAL" ? 4 : 3,
        regime: workerRegime,
        entitlementKind: "V20",
        kind: "V20",
        periodNumber: regime === "CUATRIMESTRAL" ? 4 : 3,
        dueDate: null,
        dueDateSource: "MISSING",
        dueDateConfidence: "UNKNOWN",
        sourcePayslipPeriod: periodLabel ?? "",
        confirmed: Boolean(vacationsRow?.twentyYearsOrMoreDays && vacationsRow.twentyYearsOrMoreDays > 0),
      })
    }
  }

  // 14. Procedencia
  const sourceDescription = periodLabel
    ? `Último tarjetón confirmado (${periodLabel}) y perfil laboral`
    : hasEmployment
      ? "Expediente laboral y perfil registrado"
      : "Configuración inicial recomendada"

  return {
    profile,
    continuityMark,
    nextPeriodNumber,
    dueDate,
    expiredVacationPeriods,
    enjoyedVacationDays,
    totalYearVacationDays,
    periodToEnjoy,
    regime,
    selectedInclusionMark,
    selectedStartDate: "",
    entitlements,
    warnings,
    provenance: {
      sourceDescription,
      hasLatestPayslip,
      hasProfile,
      hasEmployment,
      hasVacationProfile,
      periodLabel,
      isPorVencerMissingFromPayslip,
    },
  }
}
