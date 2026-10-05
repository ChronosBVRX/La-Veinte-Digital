import type {
  VacationPlanInput,
  VacationPlanPeriod,
  VacationPlanResult,
  VacationRegime,
  VacationRole,
} from "./types"
import { calculateCompletedYears, getCctAnnualDays, getEstatutoAnnualDays, getUnitsForInclusion, resolveVacationEntitlementUnits } from "./entitlement"
import { applyInclusionMark } from "./continuity"
import { calculateVacationPayment, calculateAnnualTotals } from "./payment-estimate"
import { getVacationRoleEndDate, hasDateOverlap } from "./calendar-roles"
import { evaluateVacationRoleEligibility } from "./role-eligibility"
import { calculateVacationRange } from "./validation"
import { getMandatoryRestDatesForRange } from "./holidays"
import { getWorkScheduleForProfile, getUnitType } from "./schedules"
import { getDayOfWeekName } from "./return-calculator"
import { findVacationMarkRule } from "./normative-rules-table"

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

  const completedYears = workerProfile ? calculateCompletedYears(workerProfile.effectiveSeniority) : 0
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
      ? (v20Entitlement || entitlements.find((e) => (e.entitlementKind === "V20" || e.kind === "V20")))
      : entitlements.find((e) => (e.entitlementKind === "ORDINARY" || e.kind === "ORDINARY" || !e.kind) && (e.sequence === idx || e.periodNumber === idx))

    const dueDate = entitlement?.dueDate ?? undefined
    const dueDateConfidence = entitlement?.dueDateConfidence ?? (entitlement?.confirmed ? "CONFIRMED" : "PROVISIONAL")
    const dueDateSource = entitlement?.dueDateSource ?? (entitlement?.confirmed ? "OFFICIAL" : "DERIVED")

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
    const effectiveRegime = isV20Period ? "EXTRAORDINARIO_V20" : regime
    const units = selectedMark !== undefined
      ? getUnitsForInclusion(
          effectiveRegime,
          totalAnnualDays,
          selectedMark,
          completedYears,
          idx,
          continuityBefore
        )
      : undefined

    const entitlementBreakdown = units !== undefined
      ? resolveVacationEntitlementUnits(units, workerProfile?.workScheduleType ?? "ORDINARY")
      : undefined
    const normativeCitation = selectedMark !== undefined
      ? findVacationMarkRule(effectiveRegime, selectedMark, continuityBefore)?.citation
      : undefined

    // 3. Validación de rol y fecha con el motor unificado de elegibilidad
    const selectedRole = sel.role
    const resolvedRoleEndDate = selectedRole
      ? getVacationRoleEndDate(selectedRole, units)
      : undefined
    const effectiveSelectedRole = selectedRole
      ? { ...selectedRole, endDate: resolvedRoleEndDate }
      : undefined
    let roleEligibilityResult = undefined
    if (selectedRole) {
      if (selectedRole.endDateByDays && units !== undefined && !resolvedRoleEndDate) {
        allowed = false
        reasons.push(`El Rol ${selectedRole.roleNumber} no contempla oficialmente ${units} días en la tabla 2027.`)
      }

      if (!selectedRole.enabled) {
        allowed = false
        reasons.push("El rol seleccionado está deshabilitado en el calendario.")
      }

      if (selectedRole.startDate) {
        roleEligibilityResult = evaluateVacationRoleEligibility({
          regime: effectiveRegime,
          entitlementKind: isV20Period ? "V20" : "ORDINARY",
          dueDate: dueDate || null,
          dueDateConfidence,
          dueDateSource,
          roleStartDate: selectedRole.startDate,
          roleEndDate: resolvedRoleEndDate,
          isFirstEverVacationPeriod: completedYears < 1 && idx === 1,
          contractType: workerProfile?.contractType,
          contractEndDate: workerProfile?.contractEndDate,
          selectedMark,
          v20Sequence: isV20Period ? 1 : undefined,
          calendarYear: calendar?.year,
          calendarStatus: calendar?.status ?? "PUBLISHED",
          retirementDate: workerProfile?.retirementDate,
        })

        if (roleEligibilityResult.status === "BLOCKED") {
          allowed = false
          reasons.push(roleEligibilityResult.workerMessage)
        } else if (roleEligibilityResult.status === "REQUIRES_REVIEW") {
          warnings.push(`Periodo ${idx}: ${roleEligibilityResult.workerMessage}`)
        } else if (roleEligibilityResult.status === "NEEDS_DATA") {
          warnings.push(`Periodo ${idx}: ${roleEligibilityResult.workerMessage}`)
        }
      }
    }

    // 4. Detección de empalmes con periodos ya procesados
    if (effectiveSelectedRole?.startDate && resolvedRoleEndDate) {
      const currentRange = {
        startDate: effectiveSelectedRole.startDate,
        endDate: resolvedRoleEndDate,
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
        radiologicalExposure: Boolean(workerProfile?.radiologicalExposure),
        mark: selectedMark,
        regime: effectiveRegime,
        sourcePayslipPeriod,
        isReconstructed: isReconstructedSmi,
        isV20: isV20Period,
      })
    }

    // 6. Cálculo de fecha exacta de reanudación de labores
    let returnDate: string | undefined = undefined
    let returnDayName: string | undefined = undefined
    let dateBreakdown = undefined

    const periodStartDate = effectiveSelectedRole?.startDate || sel.startDate
    if (periodStartDate && units !== undefined && units > 0) {
      const schedule = getWorkScheduleForProfile(workerProfile ?? { weeklyRestDays: [5, 6] })
      const uType = getUnitType(workerProfile?.workScheduleType ?? "ORDINARY")
      dateBreakdown = calculateVacationRange({
        startDate: periodStartDate,
        entitlementUnits: units,
        unitType: uType,
        weeklyRestDays: workerProfile?.weeklyRestDays ?? [5, 6],
        mandatoryRestDates: getMandatoryRestDatesForRange(periodStartDate, 400),
        workSchedule: schedule,
        contractEndDate: workerProfile?.contractEndDate,
      })
      returnDate = dateBreakdown.returnToWorkDate
      returnDayName = getDayOfWeekName(returnDate)
    }

    periods.push({
      index: idx,
      kind: isV20Period ? "V20" : "ORDINARY",
      entitlementId: entitlement?.id,
      dueDate,
      dueDateConfidence,
      dueDateSource,
      selectedRole: effectiveSelectedRole,
      selectedMark,
      startDate: periodStartDate,
      endDate: resolvedRoleEndDate || sel.endDate,
      returnDate,
      returnDayName,
      dateBreakdown,
      units,
      entitlementBreakdown,
      normativeCitation,
      continuityBefore,
      continuityAfter,
      payment,
      eligibility: roleEligibilityResult,
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
  const isValidPlan = completed && periods.length === requiredPeriodCount && periods.every((p) => p.allowed)
  const hasReviewItems = periods.some(
    (p) =>
      p.eligibility?.status === "REQUIRES_REVIEW" ||
      p.dueDateConfidence !== "CONFIRMED" ||
      (calendar && calendar.status === "DRAFT")
  )

  return {
    requiredPeriodCount,
    periods,
    totalPremium029: totals.totalPremium029,
    totalCulturalHelp048: totals.totalCulturalHelp048,
    totalGrossVacationExtra: totals.totalGrossVacationExtra,
    completed,
    warnings,
    isValidPlan,
    hasReviewItems,
  }
}
