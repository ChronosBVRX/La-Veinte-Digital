import type {
  EvaluateVacationRoleEligibilityInput,
  RoleEligibilityResult,
  CalendarCertainty,
  DateEligibility,
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

const CIVIL_MONTH_MAP: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
}

/**
 * Normaliza cualquier variante de fecha en formato civil ISO YYYY-MM-DD sin alterar días por UTC:
 * - 8 dígitos consecutivos DDMMYYYY (ej. 14102026 -> 2026-10-14)
 * - Con separadores: 14/10/2026, 14-10-2026, 14.10.2026, 14 10 2026
 * - Mes nombrado: 14-OCT-2026, 14 OCT 2026
 * - Canónico ISO ya existente: 2026-10-14
 */
export function normalizeCivilDate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const input = raw.trim()
  if (!input) return null

  // 1. Canónico ISO YYYY-MM-DD
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (parseCivilDate(input)) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
    return null
  }

  // 2. 8 dígitos continuos DDMMYYYY (o separados por espacios de OCR)
  const digitsOnly = input.replace(/\s+/g, "")
  if (/^\d{8}$/.test(digitsOnly)) {
    const day = Number(digitsOnly.slice(0, 2))
    const month = Number(digitsOnly.slice(2, 4))
    const year = Number(digitsOnly.slice(4, 8))
    const isoCandidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    if (parseCivilDate(isoCandidate)) return isoCandidate
    return null
  }

  // 3. Separadores DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const sepMatch = input.match(/^(\d{1,2})\s*[\/\-.\s]\s*(\d{1,2})\s*[\/\-.\s]\s*(\d{4})$/)
  if (sepMatch) {
    const day = Number(sepMatch[1])
    const month = Number(sepMatch[2])
    const year = Number(sepMatch[3])
    const isoCandidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    if (parseCivilDate(isoCandidate)) return isoCandidate
    return null
  }

  // 4. Mes nombrado (ej. 14-OCT-2026)
  const namedMatch = input.match(/^(\d{1,2})\s*[\/\-.\s]\s*([A-Za-z]{3,})\w*[\/\-.\s]?\s*(\d{4})$/)
  if (namedMatch) {
    const day = Number(namedMatch[1])
    const monthKey = namedMatch[2].slice(0, 3).toUpperCase()
    const month = CIVIL_MONTH_MAP[monthKey]
    const year = Number(namedMatch[3])
    if (month) {
      const isoCandidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      if (parseCivilDate(isoCandidate)) return isoCandidate
    }
    return null
  }

  return null
}

/**
 * Suma N meses naturales a una fecha civil YYYY-MM-DD sin desfases por huso horario.
 * Ajusta al último día del mes destino si el día original excede los días de ese mes.
 */
export function addCivilMonths(dateStr: string, monthsToAdd: number): string | null {
  const parts = parseCivilDate(dateStr)
  if (!parts) return null
  let year = parts.year
  let month = parts.month + monthsToAdd
  while (month > 12) {
    year += 1
    month -= 12
  }
  while (month < 1) {
    year -= 1
    month += 12
  }
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const maxDay = daysInMonth[month - 1]
  const day = Math.min(parts.day, maxDay)
  const dd = String(day).padStart(2, "0")
  const mm = String(month).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

/**
 * Formatea los días de anticipación respecto a la fecha de adquisición del derecho en frase institucional clara:
 * - Días positivos: "Este rol inicia X días antes de que generes el derecho"
 * - Días negativos: "Este rol inicia X días después de que generes el derecho"
 * - Cero: "Este rol inicia el mismo día en que generas tu derecho"
 */
export function formatAnticipationCivilPhrase(daysBeforeDue: number | null | undefined): string {
  if (daysBeforeDue === null || daysBeforeDue === undefined) return ""
  if (daysBeforeDue > 0) {
    return `Este rol inicia ${daysBeforeDue} días antes de que generes el derecho`
  }
  if (daysBeforeDue < 0) {
    return `Este rol inicia ${Math.abs(daysBeforeDue)} días después de que generes el derecho`
  }
  return "Este rol inicia el mismo día en que generas tu derecho"
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
 * Separa limpiamente dateEligibility ("ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN")
 * de calendarCertainty ("OFFICIAL" | "PRELIMINARY").
 */
export function evaluateVacationRoleEligibility(
  input: EvaluateVacationRoleEligibilityInput
): RoleEligibilityResult {
  const {
    regime,
    entitlementKind,
    dueDate: rawDueDate,
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

  const calendarCertainty: CalendarCertainty = calendarStatus === "DRAFT" ? "PRELIMINARY" : "OFFICIAL"
  const dueDate = normalizeCivilDate(rawDueDate)

  // 1. Validación de fecha de vencimiento/generación del derecho
  if (!dueDate) {
    return {
      status: "NEEDS_DATA",
      reasonCode: "MISSING_DUE_DATE",
      workerMessage:
        "Falta tu fecha de vencimiento: falta validar la fecha en la que generas este derecho en tu tarjetón.",
      technicalMessage:
        "No se proporcionó fecha oficial de vencimiento/generación del derecho (dueDate es nulo o inválido).",
      dueDate: null,
      earliestAllowedDate: null,
      daysBeforeDue: null,
      evaluation: {
        dateEligibility: "UNKNOWN",
        calendarCertainty,
        selectableForSimulation: true,
        confirmableAsOfficial: false,
      },
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
      evaluation: {
        dateEligibility: "UNKNOWN",
        calendarCertainty,
        selectableForSimulation: false,
        confirmableAsOfficial: false,
      },
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
        evaluation: {
          dateEligibility: "UNKNOWN",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
        evaluation: {
          dateEligibility: "NOT_ELIGIBLE",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
        evaluation: {
          dateEligibility: "NOT_ELIGIBLE",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
      evaluation: {
        dateEligibility: "NOT_ELIGIBLE",
        calendarCertainty,
        selectableForSimulation: false,
        confirmableAsOfficial: false,
      },
    }
  }

  // 5. Regla especial: Personal sujeto al Estatuto
  const isEstatuto = regime === "ESTATUTO" || contractType === "CONFIANZA_A_ESTATUTO"
  if (isEstatuto && daysBeforeDue > 0) {
    return {
      status: "BLOCKED",
      reasonCode: "ESTATUTO_NO_ANTICIPATION",
      workerMessage:
        "El personal sujeto al Estatuto no cuenta con anticipación ordinaria automática. Las vacaciones deben disfrutarse a partir de la fecha en que se genera el derecho.",
      technicalMessage: "Régimen Estatuto prohíbe anticipación ordinaria previa al vencimiento.",
      dueDate,
      earliestAllowedDate: dueDate,
      daysBeforeDue,
      evaluation: {
        dateEligibility: "NOT_ELIGIBLE",
        calendarCertainty,
        selectableForSimulation: false,
        confirmableAsOfficial: false,
      },
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
        evaluation: {
          dateEligibility: "NOT_ELIGIBLE",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
        evaluation: {
          dateEligibility: "NOT_ELIGIBLE",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
          evaluation: {
            dateEligibility: "NOT_ELIGIBLE",
            calendarCertainty,
            selectableForSimulation: false,
            confirmableAsOfficial: false,
          },
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
        evaluation: {
          dateEligibility: "NOT_ELIGIBLE",
          calendarCertainty,
          selectableForSimulation: false,
          confirmableAsOfficial: false,
        },
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
      evaluation: {
        dateEligibility: "NOT_ELIGIBLE",
        calendarCertainty,
        selectableForSimulation: false,
        confirmableAsOfficial: false,
      },
    }
  }

  // Si llegó aquí, las fechas son completamente compatibles:
  const dateEligibility: DateEligibility = "ELIGIBLE"

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
      evaluation: {
        dateEligibility,
        calendarCertainty,
        selectableForSimulation: true,
        confirmableAsOfficial: false,
      },
    }
  }

  // 9. Comprobación de estado del calendario preliminar (DRAFT)
  if (calendarStatus === "DRAFT") {
    const yearLabel = calendarYear ? String(calendarYear) : "2027"
    return {
      status: "REQUIRES_REVIEW",
      reasonCode: "CALENDAR_DRAFT",
      workerMessage: `Compatible con tus fechas. Calendario preliminar ${yearLabel} (borrador preliminar); confirma el rol cuando se publique el calendario oficial.`,
      technicalMessage: "calendarStatus es DRAFT; rol compatible para simulación, pero no confirmable como oficial.",
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
      evaluation: {
        dateEligibility,
        calendarCertainty: "PRELIMINARY",
        selectableForSimulation: true,
        confirmableAsOfficial: false,
      },
    }
  }

  // 10. Comprobación de fecha provisional / proyectada
  if (dueDateConfidence !== "CONFIRMED") {
    return {
      status: "REQUIRES_REVIEW",
      reasonCode: "PROVISIONAL_DUE_DATE",
      workerMessage:
        "Compatible con tus fechas. Todavía no podemos confirmar este rol porque falta validar la fecha en la que generas este derecho (fecha estimada o calculada); confirma el dato con Personal antes de programar.",
      technicalMessage: `dueDateConfidence es ${dueDateConfidence}. No se autoriza definitivamente sin confirmación de tarjetón o registro oficial.`,
      dueDate,
      earliestAllowedDate,
      daysBeforeDue,
      evaluation: {
        dateEligibility,
        calendarCertainty,
        selectableForSimulation: true,
        confirmableAsOfficial: false,
      },
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
    evaluation: {
      dateEligibility: "ELIGIBLE",
      calendarCertainty: "OFFICIAL",
      selectableForSimulation: true,
      confirmableAsOfficial: true,
    },
  }
}
