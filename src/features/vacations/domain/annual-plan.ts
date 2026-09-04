import type {
  VacationPlanInput,
  VacationPlanPeriod,
  VacationPlanResult,
  VacationRegime,
  VacationRole,
} from "./types"
import { calculateCompletedYears, getCctAnnualDays, getEstatutoAnnualDays, getUnitsForInclusion } from "./entitlement"
import { applyInclusionMark } from "./continuity"
import { calculateVacationPayment, calculateAnnualTotals } from "./payment-estimate"
import { checkRoleDateEligibility, hasDateOverlap } from "./calendar-roles"

/**
 * Determina el número de periodos que el trabajador debe programar en su plan anual.
 *
 * - Semestral sin V20: 2 periodos ordinarios.
 * - Semestral con V20: 3 periodos (2 ordinarios + 1 V20).
 * - Cuatrimestral sin V20: 3 periodos ordinarios.
 * - Cuatrimestral con V20: 4 periodos (3 ordinarios + 1 V20).
 */
export function getRequiredPeriodCount(regime: VacationRegime, hasV20: boolean): number {
  if (regime === "CUATRIMESTRAL") {
    return hasV20 ? 4 : 3
  }
  return hasV20 ? 3 : 2
}

export interface PlanSelectionStep {
  role?: VacationRole
  mark?: number
  startDate?: string
  endDate?: string
}

/**
 * Construye o recalcula el plan anual completo encadenando la continuidad
 * ordinaria periodo tras periodo y manteniendo el V20 independiente.
 */
export function buildVacationPlan(
  input: VacationPlanInput,
  selections: Record<number, PlanSelectionStep> = {}
): VacationPlanResult {
  const {
    workerProfile,
    regime,
    initialContinuity,
    entitlements,
    calendar,
    integratedMonthlySalary,
    sourcePayslipPeriod,
    isReconstructedSmi = false,
  } = input

  const completedYears = calculateCompletedYears(workerProfile.effectiveSeniority)
  const totalAnnualDays = regime === "ESTATUTO"
    ? getEstatutoAnnualDays(completedYears)
    : getCctAnnualDays(completedYears)

  const v20Entitlement = entitlements.find((e) => e.kind === "V20" && e.confirmed)
  const hasV20 = Boolean(v20Entitlement || (completedYears >= 20 && entitlements.some((e) => e.kind === "V20")))

  const requiredPeriodCount = getRequiredPeriodCount(regime, hasV20)
  const periods: VacationPlanPeriod[] = []
  const warnings: string[] = []

  let currentContinuity = initialContinuity

  for (let idx = 1; idx <= requiredPeriodCount; idx++) {
    const isV20Period = hasV20 && idx === requiredPeriodCount
    const sel = selections[idx] || {}
    const reasons: string[] = []
    let allowed = true

    const entitlement = isV20Period
      ? (v20Entitlement || entitlements.find((e) => e.kind === "V20"))
      : entitlements.find((e) => e.kind === "ORDINARY" && e.periodNumber === idx)

    const dueDate = entitlement?.dueDate

    // 1. Marca y continuidad
    const selectedMark = sel.mark
    const continuityBefore = isV20Period ? undefined : currentContinuity
    let continuityAfter: number | undefined = undefined

    if (selectedMark !== undefined) {
      if (!isV20Period) {
        const trans = applyInclusionMark(regime, currentContinuity, selectedMark)
        if ("error" in trans) {
          allowed = false
          reasons.push(trans.error)
        } else {
          continuityAfter = trans.nextContinuity
          currentContinuity = trans.nextContinuity
        }
      } else {
        // V20 marcas: 0, 6, 7, 8
        if (![0, 6, 7, 8].includes(selectedMark)) {
          allowed = false
          reasons.push(`La marca ${selectedMark} no es válida para el periodo extraordinario V20 (use 0, 6, 7 u 8).`)
        }
      }
    }

    // 2. Unidades disfrutadas
    const units = selectedMark !== undefined
      ? getUnitsForInclusion(
          isV20Period ? "EXTRAORDINARIO_V20" : regime,
          totalAnnualDays,
          selectedMark,
          completedYears,
          idx
        )
      : undefined

    // 3. Validación de rol y fecha
    const selectedRole = sel.role
    if (selectedRole) {
      if (!selectedRole.enabled) {
        allowed = false
        reasons.push("El rol seleccionado está deshabilitado en el calendario.")
      }

      // Validación contra fecha de vencimiento/generación
      if (dueDate && selectedRole.startDate) {
        const elig = checkRoleDateEligibility(
          selectedRole.startDate,
          dueDate,
          regime === "CUATRIMESTRAL" ? 105 : 120
        )
        if (!elig.allowed) {
          allowed = false
          reasons.push(elig.reason || "La fecha del rol no cumple las reglas de anticipación con tu fecha de vencimiento.")
        }
      }
    }

    // 4. Detección de empalmes con periodos ya procesados
    if (selectedRole?.startDate) {
      const currentRange = {
        startDate: selectedRole.startDate,
        endDate: selectedRole.endDate || selectedRole.startDate,
      }
      for (let prevIdx = 0; prevIdx < periods.length; prevIdx++) {
        const prevP = periods[prevIdx]
        if (prevP.selectedRole?.startDate) {
          const prevRange = {
            startDate: prevP.selectedRole.startDate,
            endDate: prevP.selectedRole.endDate || prevP.selectedRole.startDate,
          }
          if (hasDateOverlap(currentRange, prevRange)) {
            allowed = false
            reasons.push(`Este periodo se empalma con el Periodo ${prevIdx + 1} (${prevRange.startDate} a ${prevRange.endDate}).`)
          }
        }
      }
    }

    // 5. Cálculo económico del periodo
    let payment = undefined
    if (units !== undefined) {
      payment = calculateVacationPayment({
        integratedMonthlySalary,
        daysOrUnits: units,
        seniorityYears: completedYears,
        radiologicalExposure: workerProfile.radiologicalExposure,
        mark: selectedMark,
        regime: isV20Period ? "EXTRAORDINARIO_V20" : regime,
        sourcePayslipPeriod,
        isReconstructed: isReconstructedSmi,
        isV20: isV20Period,
      })
    }

    periods.push({
      index: idx,
      kind: isV20Period ? "V20" : "ORDINARY",
      entitlementId: entitlement?.id,
      dueDate,
      selectedRole,
      selectedMark,
      startDate: selectedRole?.startDate || sel.startDate,
      endDate: selectedRole?.endDate || sel.endDate,
      units,
      continuityBefore,
      continuityAfter,
      payment,
      allowed,
      reasons,
    })
  }

  // Totales anuales
  const totals = calculateAnnualTotals(periods.map((p) => p.payment))

  if (calendar && calendar.year === 2027 && calendar.status === "DRAFT") {
    warnings.push("El calendario 2027 todavía no está publicado oficialmente por el IMSS. Las fechas de los roles son provisionales.")
  }

  const completed = periods.every((p) => p.selectedRole && p.selectedMark !== undefined && p.allowed)

  return {
    requiredPeriodCount,
    periods,
    totalPremium029: totals.totalPremium029,
    totalCulturalHelp048: totals.totalCulturalHelp048,
    totalGrossVacationExtra: totals.totalGrossVacationExtra,
    completed,
    warnings,
  }
}
