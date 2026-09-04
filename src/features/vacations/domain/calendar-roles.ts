import type { VacationRole } from "./types"

export interface RoleValidationResult {
  valid: boolean
  errors: string[]
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
    if (!role.endDate) {
      errors.push(`El rol #${role.roleNumber} está habilitado pero no tiene fecha de término (endDate).`)
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

    if (r.enabled && !r.endDate) {
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

  const roleDate = new Date(roleStartDate + "T00:00:00")
  const dueDate = new Date(entitlementDueDate + "T00:00:00")

  if (isNaN(roleDate.getTime()) || isNaN(dueDate.getTime())) {
    return { allowed: true }
  }

  const diffMs = dueDate.getTime() - roleDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  // Si la fecha del rol es posterior a dueDate, el derecho ya está generado
  if (diffDays <= 0) {
    return { allowed: true }
  }

  // Si la fecha del rol es anterior al vencimiento, verificar anticipación máxima permitida
  if (diffDays > maxAnticipationDays) {
    return {
      allowed: false,
      reason: `Esta fecha (${roleStartDate}) tiene ${diffDays} días de anticipación al vencimiento (${entitlementDueDate}), lo que excede el límite permitido de ${maxAnticipationDays} días.`,
    }
  }

  return { allowed: true }
}
