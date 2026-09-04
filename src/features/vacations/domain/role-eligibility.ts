import type {
  EvaluateVacationRoleEligibilityInput,
  RoleEligibilityResult,
} from "./types"

/**
 * Parsea una fecha ISO YYYY-MM-DD en sus componentes de fecha civil (sin horas ni husos horarios).
 */
export function parseCivilDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== "string") return null
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Validación de días válidos en el mes (incluyendo años bisiestos)
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

/**
 * Resta N días naturales a una fecha civil YYYY-MM-DD.
 */
export function subtractCivilDays(dateStr: string, days: number): string {
  const parts = parseCivilDate(dateStr)
  if (!parts) return dateStr
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - days))
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Calcula la diferencia en días naturales entre dos fechas civiles (dateA - dateB).
 */
export function diffCivilDays(dateA: string, dateB: string): number {
  const p1 = parseCivilDate(dateA)
  const p2 = parseCivilDate(dateB)
  if (!p1 || !p2) return 0
  const t1 = Date.UTC(p1.year, p1.month - 1, p1.day)
  const t2 = Date.UTC(p2.year, p2.month - 1, p2.day)
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24))
}

/**
 * Formatea una fecha ISO civil en DD/MM/AAAA.
 */
export function formatCivilMexicanDate(dateStr: string): string {
  const parts = parseCivilDate(dateStr)
  if (!parts) return dateStr
  const dd = String(parts.day).padStart(2, "0")
  const mm = String(parts.month).padStart(2, "0")
  const yyyy = String(parts.year)
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Determina la anticipación ordinaria máxima en días naturales según el régimen.
 * - Semestral: 120 días naturales
 * - Cuatrimestral: 105 días naturales
 * - Estatuto: 0 días (sin anticipación automática)
 */
export function getMaxAnticipationDays(regime: string): number {
  switch (regime) {
    case "CUATRIMESTRAL":
      return 105
    case "ESTATUTO":
      return 0
    case "SEMESTRAL":
    default:
      return 120
  }
}

/**
 * Motor único y puro para evaluar la elegibilidad de un rol vacacional
 * respecto a la fecha en que se genera el derecho y las reglas normativas.
 */
export function evaluateVacationRoleEligibility(
  input: EvaluateVacationRoleEligibilityInput
): RoleEligibilityResult {
  const {
    regime,
    entitlementKind,
    dueDate,
    dueDateConfidence = "CONFIRMED",
    roleStartDate,
    roleEndDate,
    isFirstEverVacationPeriod = false,
    contractType,
    contractEndDate,
    selectedMark,
    v20Sequence = 1,
    calendarYear,
    calendarStatus = "PUBLISHED",
  } = input

  // 1. Validación de fecha de vencimiento/generación del derecho
  if (!dueDate || !dueDate.trim() || !parseCivilDate(dueDate)) {
    return {
      status: "NEEDS_DATA",
      reasonCode: "MISSING_DUE_DATE",
      workerMessage:
        "Todavía no podemos confirmar este rol porque falta validar la fecha en la que generas este derecho. Puedes revisar la simulación, pero confirma el dato con Personal antes de programar.",
      technicalMessage:
        "No se proporcionó fecha oficial de vencimiento/generación del derecho (dueDate es nulo o inválido).",
      dueDate: null,
      earliestAllowedDate: null,
      daysBeforeDue: null,
    }
  }

  // 2. Validación de fecha del rol
  if (!roleStartDate || !roleStartDate.trim() || !parseCivilDate(roleStartDate)) {
    return {
      status: "NEEDS_DATA",
      reasonCode: "INVALID_ROLE_DATE",
      workerMessage: "El rol seleccionado no cuenta con fecha de inicio válida en formato AAAA-MM-DD.",
      technicalMessage: `roleStartDate "${roleStartDate}" no tiene formato ISO válido.`,
      dueDate,
      earliestAllowedDate: null,
      daysBeforeDue: null,
    }
  }

  // Días de anticipación respecto a la fecha en que se genera el derecho:
  // > 0 significa que el rol inicia antes de adquirir el derecho.
  // <= 0 significa que el rol inicia en o después de adquirir el derecho.
  const daysBeforeDue = diffCivilDays(dueDate, roleStartDate)

  // Anticipación ordinaria máxima
  const maxAnticipation = entitlementKind === "V20"
    ? 120
    : getMaxAnticipationDays(regime)

  const earliestAllowedDate = subtractCivilDays(dueDate, maxAnticipation)

  // 3. Regla especial: Personal temporal o sustituto
  const isTemporal = contractType === "TEMPORAL" || contractType === "SUSTITUTO"
  if (isTemporal) {
    if (!contractEndDate || !parseCivilDate(contractEndDate)) {
      return {
        status: "REQUIRES_REVIEW",
        reasonCode: "TEMPORAL_MISSING_CONTRACT_END",
        workerMessage:
          "Para personal temporal o sustituto se requiere validar la fecha de término del contrato antes de autorizar el rol.",
        technicalMessage: "Personal temporal/sustituto sin fecha contractEndDate válida.",
        dueDate,
        earliestAllowedDate,
        daysBeforeDue,
      }
    }

    if (roleStartDate > contractEndDate) {
      return {
        status: "BLOCKED",
        reasonCode: "ROLE_STARTS_AFTER_CONTRACT",
        workerMessage: `Este rol no puede elegirse porque inicia (${formatCivilMexicanDate(
          roleStartDate
        )}) después del término de tu contrato (${formatCivilMexicanDate(contractEndDate)}).`,
        technicalMessage: `roleStartDate (${roleStartDate}) supera contractEndDate (${contractEndDate}).`,
        dueDate,
        earliestAllowedDate,
        daysBeforeDue,
      }
    }

    const effectiveEnd = roleEndDate || roleStartDate
    if (effectiveEnd > contractEndDate) {
      return {
        status: "BLOCKED",
        reasonCode: "ROLE_ENDS_AFTER_CONTRACT",
        workerMessage: `Este rol no puede elegirse porque termina (${formatCivilMexicanDate(
          effectiveEnd
        )}) después de la vigencia de tu contrato (${formatCivilMexicanDate(
          contractEndDate
        )}). El inicio y el término deben quedar dentro de tu contrato.`,
        technicalMessage: `effectiveEnd (${effectiveEnd}) supera contractEndDate (${contractEndDate}).`,
        dueDate,
        earliestAllowedDate,
        daysBeforeDue,
      }
    }
  }

  // 4. Regla especial: Primer periodo del trabajador
  if (isFirstEverVacationPeriod && daysBeforeDue > 0) {
    return {
      status: "BLOCKED",
      reasonCode: "FIRST_PERIOD_BEFORE_DUE_DATE",
      workerMessage:
        "Este es tu primer periodo vacacional. Primero debes cumplir la fecha en la que generas el derecho.",
      technicalMessage: `Primer periodo no admite anticipación (daysBeforeDue=${daysBeforeDue} > 0 respecto a ${dueDate}).`,
      dueDate,
      earliestAllowedDate: dueDate,
      daysBeforeDue,
    }
  }

  // 5. Regla especial: Personal sujeto al Estatuto
  const isEstatuto = regime === "ESTATUTO" || contractType === "CONFIANZA_A_ESTATUTO"
  if (isEstatuto) {
    if (daysBeforeDue > 0) {
      return {
        status: "BLOCKED",
        reasonCode: "ESTATUTO_NO_ANTICIPATION",
        workerMessage:
          "El personal sujeto al Estatuto no cuenta con anticipación ordinaria automática. Las vacaciones deben disfrutarse a partir de la fecha en que se genera el derecho.",
        technicalMessage: "Régimen Estatuto prohíbe anticipación ordinaria previa al vencimiento.",
        dueDate,
        earliestAllowedDate: dueDate,
        daysBeforeDue,
      }
    }
  }

  // 6. Regla especial: Vacaciones V20
  if (entitlementKind === "V20" || regime === "EXTRAORDINARIO_V20") {
    // Primer periodo V20: no puede disfrutarse antes de adquirir el derecho
    if (v20Sequence <= 1 && daysBeforeDue > 0) {
      return {
        status: "BLOCKED",
        reasonCode: "V20_FIRST_PERIOD_NO_ANTICIPATION",
        workerMessage:
          "El primer periodo de vacaciones por 20 años (V20) no puede disfrutarse antes de adquirir el derecho.",
        technicalMessage: "Primer periodo extraordinario V20 no admite anticipación antes del vencimiento.",
        dueDate,
        earliestAllowedDate: dueDate,
        daysBeforeDue,
      }
    }

    // Periodos V20 posteriores: hasta 120 días
    if (v20Sequence > 1 && daysBeforeDue > 120) {
      return {
        status: "BLOCKED",
        reasonCode: "V20_EXCEEDS_ANTICIPATION",
        workerMessage:
          "Este rol V20 excede los 120 días de anticipación permitidos respecto a la fecha en que se genera el derecho.",
        technicalMessage: `Anticipación V20 (${daysBeforeDue} días) excede el máximo permitido de 120 días.`,
        dueDate,
        earliestAllowedDate,
        daysBeforeDue,
      }
    }

    // Marca 7: debe vencer en el año del calendario que se programa
    if (selectedMark === 7) {
      const dueYear = parseCivilDate(dueDate)?.year
      if (calendarYear && dueYear && dueYear !== calendarYear) {
        return {
          status: "BLOCKED",
          reasonCode: "V20_MARK_7_YEAR_MISMATCH",
          workerMessage: `La marca 7 exige que el derecho vacacional venza en el mismo año que se programa (${calendarYear}).`,
          technicalMessage: `Marca 7 requiere que el año de dueDate (${dueYear}) coincida con calendarYear (${calendarYear}).`,
          dueDate,
          earliestAllowedDate,
          daysBeforeDue,
        }
      }
    }

    // Marca 8 (acumulación para jubilación): no debe anticiparse antes de su vencimiento
    if (selectedMark === 8 && daysBeforeDue > 0) {
      return {
        status: "BLOCKED",
        reasonCode: "V20_MARK_8_NO_ANTICIPATION",
        workerMessage:
          "La marca 8 (acumulación para jubilación) no puede anticiparse antes de la fecha de generación del derecho.",
        technicalMessage: "Marca 8 de jubilación prohíbe anticipación previa a la fecha de vencimiento.",
        dueDate,
        earliestAllowedDate: dueDate,
        daysBeforeDue,
      }
    }
  }

  // 7. Regla de anticipación ordinaria (Semestral 120 días / Cuatrimestral 105 días)
  if (daysBeforeDue > maxAnticipation) {
    const regimeLabel = regime === "CUATRIMESTRAL" ? "cuatrimestral" : "semestral"
    return {
      status: "BLOCKED",
      reasonCode: "EXCEEDS_ANTICIPATION",
      workerMessage: `Este rol todavía no te corresponde. Tu derecho se genera el ${formatCivilMexicanDate(
        dueDate
      )} y, por ser ${regimeLabel}, solo puedes adelantarlo hasta ${maxAnticipation} días. Lo más pronto que puedes iniciar es el ${formatCivilMexicanDate(
        earliestAllowedDate
      )}.`,
      technicalMessage: `roleStartDate (${roleStartDate}) anticipa ${daysBeforeDue} días naturales, superando el límite de ${maxAnticipation} días respecto a dueDate (${dueDate}).`,
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
    }
  }

  // 8. Cruce de año con anticipación
  const startYear = parseCivilDate(roleStartDate)?.year
  const dueYear = parseCivilDate(dueDate)?.year
  if (startYear && dueYear && startYear !== dueYear && daysBeforeDue > 0) {
    return {
      status: "REQUIRES_REVIEW",
      reasonCode: "YEAR_CROSSING_REQUIRES_REVIEW",
      workerMessage:
        "La anticipación cruza de año calendario respecto a la fecha en que generas el derecho. Esta situación requiere validación con Personal.",
      technicalMessage: `Anticipación cruza de año calendario: roleStartDate (${roleStartDate}) vs dueDate (${dueDate}).`,
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
    }
  }

  // 9. Comprobación de fecha provisional / proyectada
  if (dueDateConfidence !== "CONFIRMED") {
    return {
      status: "REQUIRES_REVIEW",
      reasonCode: "PROVISIONAL_DUE_DATE",
      workerMessage:
        "Todavía no podemos confirmar este rol porque falta validar la fecha en la que generas este derecho. Puedes revisar la simulación, pero confirma el dato con Personal antes de programar.",
      technicalMessage: `dueDateConfidence es ${dueDateConfidence}. No se autoriza definitivamente sin confirmación de tarjetón o registro oficial.`,
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
    }
  }

  // 10. Comprobación de estado del calendario
  if (calendarStatus === "DRAFT") {
    return {
      status: "REQUIRES_REVIEW",
      reasonCode: "CALENDAR_DRAFT",
      workerMessage:
        "Este rol cumple con las fechas, pero el calendario se encuentra en borrador preliminar. La autorización definitiva requiere la publicación oficial del calendario.",
      technicalMessage: "calendarStatus es DRAFT; solo un calendario PUBLISHED produce autorización ALLOWED.",
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
    }
  }

  // 11. Autorizado definitivamente
  return {
    status: "ALLOWED",
    reasonCode: "ROLE_ALLOWED",
    workerMessage: "Sí puedes elegir este rol. Comienza dentro de las fechas permitidas para tu periodo.",
    technicalMessage: "Cumple con las reglas de anticipación legal, vigencia contractual y calendario publicado.",
    dueDate,
    earliestAllowedDate,
    daysBeforeDue,
  }
}
