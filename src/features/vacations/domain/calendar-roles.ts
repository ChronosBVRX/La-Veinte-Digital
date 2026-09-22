import type { VacationCalendarDayCount, VacationRole } from "./types"

export interface RoleValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Devuelve la fecha oficial de término para la cantidad de días indicada.
 * Si existe una matriz por días, nunca cae silenciosamente al endDate fijo.
 */
export function getVacationRoleEndDate(
  role: VacationRole,
  days: number | undefined
): string | undefined {
  if (role.endDateByDays) {
    if (days === undefined || !Number.isInteger(days)) return undefined
    return role.endDateByDays[days as VacationCalendarDayCount]
  }
  return role.endDate
}

/**
 * Valida un rol individual de vacaciones.
 */
export function validateCalendarRole(role: VacationRole): RoleValidationResult {
  const errors: string[] = []

  if (!role.roleNumber || role.roleNumber <= 0 || !Number.isInteger(role.roleNumber)) {
    errors.push(`El número de rol debe ser un entero positivo mayor a 0 (recibido: ${role.roleNumber}).`)
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!role.startDate || !dateRegex.test(role.startDate)) {
    errors.push(`La fecha de inicio "${role.startDate}" no tiene el formato ISO YYYY-MM-DD.`)
  }

  if (role.enabled) {
    const matrixEntries = Object.entries(role.endDateByDays ?? {})
    if (matrixEntries.length > 0) {
      for (const [rawDays, endDate] of matrixEntries) {
        const days = Number(rawDays)
        if (!Number.isInteger(days) || days < 7 || days > 20) {
          errors.push(`El rol #${role.roleNumber} contiene una cantidad de días no válida: ${rawDays}.`)
        }
        if (!dateRegex.test(endDate)) {
          errors.push(`La fecha de término "${endDate}" no tiene el formato ISO YYYY-MM-DD.`)
        } else if (role.startDate && endDate < role.startDate) {
          errors.push(`La fecha de término (${endDate}) no puede ser anterior a la de inicio (${role.startDate}).`)
        }
      }
    } else if (!role.endDate) {
      errors.push(`El rol #${role.roleNumber} está habilitado pero no tiene fecha de término ni matriz endDateByDays.`)
    } else if (!dateRegex.test(role.endDate)) {
      errors.push(`La fecha de término "${role.endDate}" no tiene el formato ISO YYYY-MM-DD.`)
    } else if (role.startDate && role.endDate < role.startDate) {
      errors.push(`La fecha de término (${role.endDate}) no puede ser anterior a la de inicio (${role.startDate}).`)
    }
  }

  if (role.roleGroup && !["A", "B", "GENERAL"].includes(role.roleGroup)) {
    errors.push(`El grupo de rol "${role.roleGroup}" no es válido. Debe ser "A", "B" o "GENERAL".`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Valida una lista completa de roles para un calendario.
 */
export function validateCalendarRoleList(roles: VacationRole[]): {
  valid: boolean
  errors: string[]
  missingEndDates: number
  duplicateNumbers: number[]
} {
  const errors: string[] = []
  let missingEndDates = 0
  const seenNumbers = new Set<number>()
  const duplicateNumbers: number[] = []

  if (!roles || roles.length === 0) {
    return {
      valid: false,
      errors: ["El calendario no contiene ningún rol de vacaciones."],
      missingEndDates: 0,
      duplicateNumbers: [],
    }
  }

  for (const r of roles) {
    const rVal = validateCalendarRole(r)
    if (!rVal.valid) {
      errors.push(...rVal.errors)
    }

    if (r.enabled && !r.endDate && Object.keys(r.endDateByDays ?? {}).length === 0) {
      missingEndDates++
    }

    if (seenNumbers.has(r.roleNumber)) {
      duplicateNumbers.push(r.roleNumber)
      errors.push(`Número de rol duplicado: #${r.roleNumber}.`)
    } else {
      seenNumbers.add(r.roleNumber)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingEndDates,
    duplicateNumbers,
  }
}

/**
 * Verifica si dos rangos de fechas se empalman.
 */
export function hasDateOverlap(
  rangeA: { startDate: string; endDate?: string },
  rangeB: { startDate: string; endDate?: string }
): boolean {
  const endA = rangeA.endDate || rangeA.startDate
  const endB = rangeB.endDate || rangeB.startDate

  return rangeA.startDate <= endB && endA >= rangeB.startDate
}

import { evaluateVacationRoleEligibility } from "./role-eligibility"

/**
 * Comprueba si la fecha de inicio del rol es compatible con la fecha de vencimiento/generación.
 * Máximo 120 días de anticipación para semestral y 105 para cuatrimestral.
 */
export function checkRoleDateEligibility(
  roleStartDate: string,
  entitlementDueDate?: string,
  maxAnticipationDays: number = 120
): { allowed: boolean; reason?: string } {
  if (!entitlementDueDate) {
    return { allowed: true }
  }

  const regime = maxAnticipationDays <= 105 ? "CUATRIMESTRAL" : "SEMESTRAL"
  const res = evaluateVacationRoleEligibility({
    regime,
    entitlementKind: "ORDINARY",
    dueDate: entitlementDueDate,
    dueDateConfidence: "CONFIRMED",
    roleStartDate,
    calendarStatus: "PUBLISHED",
  })

  return {
    allowed: res.status === "ALLOWED",
    reason: res.status !== "ALLOWED" ? `${res.workerMessage} (excede el límite permitido de ${maxAnticipationDays} días)` : undefined,
  }
}
