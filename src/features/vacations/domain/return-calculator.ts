import type { VacationRegime, WorkScheduleType, WorkScheduleDefinition } from "./types"
import { getCctAnnualDays, getVacationDivision, getEstatutoAnnualDays } from "./entitlement"
import { isWeeklyRest } from "./holidays"
import { isWorkDay, getWorkScheduleForProfile } from "./schedules"
import { getImssMandatoryRestDays, type ImssMandatoryRestDay } from "@/features/calendario/domain/mandatory-rest-days"

export type VacationPeriodSelection =
  | "FIRST_PERIOD"
  | "SECOND_PERIOD"
  | "FULL_CYCLE"
  | "CUSTOM"

export interface VacationReturnInput {
  startDate: string // "YYYY-MM-DD"
  seniorityYears?: number
  periodSelection?: VacationPeriodSelection
  customEntitlementDays?: number
  daysOnAccount?: number
  weeklyRestDays: number[] // 0 = Lunes, ..., 6 = Domingo
  workScheduleType?: WorkScheduleType
  regime?: VacationRegime
}

export type DayClassification =
  | "VACATION_DAY"
  | "WEEKLY_REST"
  | "MANDATORY_REST"
  | "RETURN_TO_WORK"

export interface VacationDayDetail {
  date: string // "YYYY-MM-DD"
  dayNumber: number
  monthNumber: number
  year: number
  dayOfWeekIndex: number // 0 = Lunes, ..., 6 = Domingo
  dayOfWeekName: string // "Lunes", "Martes", etc.
  formattedDate: string // "15 de mayo de 2027"
  classification: DayClassification
  holidayTitle?: string
  isLastVacationDay?: boolean
  isReturnDay?: boolean
}

export interface VacationReturnResult {
  startDate: string
  lastVacationDate: string
  returnToWorkDate: string
  returnDayName: string
  lastVacationDayName: string
  formattedStartDate: string
  formattedLastVacationDate: string
  formattedReturnDate: string
  baseAnnualDays: number
  grossPeriodDays: number
  daysOnAccount: number
  netVacationDays: number
  totalCalendarDays: number
  weeklyRestDaysCount: number
  mandatoryRestDaysCount: number
  timeline: VacationDayDetail[]
  mandatoryHolidaysInPeriod: { date: string; title: string }[]
  summarySentence: string
  copyableText: string
}

const SPANISH_DAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
]

const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

export function formatCivilDateSpanish(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  const [y, m, d] = dateStr.split("-").map(Number)
  const monthName = SPANISH_MONTHS[m - 1] ?? ""
  return `${d} de ${monthName} de ${y}`
}

export function formatCivilDateWithDayOfWeek(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayIndex = (dt.getUTCDay() + 6) % 7 // 0=Lun ... 6=Dom
  const dayName = SPANISH_DAYS[dayIndex]
  const monthName = SPANISH_MONTHS[m - 1] ?? ""
  return `${dayName} ${d} de ${monthName} de ${y}`
}

export function getDayOfWeekIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (dt.getUTCDay() + 6) % 7 // 0=Lun, ..., 6=Dom
}

export function getDayOfWeekName(dateStr: string): string {
  return SPANISH_DAYS[getDayOfWeekIndex(dateStr)] ?? ""
}

function addDaysToCivilDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

/**
 * Calcula el derecho base en días hábiles conforme al CCT y la selección de periodo.
 */
export function getPeriodGrossDays(
  seniorityYears: number,
  periodSelection: VacationPeriodSelection = "FIRST_PERIOD",
  customEntitlementDays?: number,
  regime: VacationRegime = "SEMESTRAL"
): { baseAnnualDays: number; grossPeriodDays: number } {
  if (periodSelection === "CUSTOM" && customEntitlementDays !== undefined) {
    const validCustom = Math.max(1, Math.min(60, Math.round(customEntitlementDays)))
    return {
      baseAnnualDays: validCustom,
      grossPeriodDays: validCustom,
    }
  }

  const baseAnnualDays = regime === "ESTATUTO"
    ? getEstatutoAnnualDays(seniorityYears)
    : getCctAnnualDays(seniorityYears)

  if (periodSelection === "FULL_CYCLE") {
    return {
      baseAnnualDays,
      grossPeriodDays: baseAnnualDays,
    }
  }

  const [firstPart, secondPart] = getVacationDivision(baseAnnualDays)
  if (periodSelection === "SECOND_PERIOD") {
    return {
      baseAnnualDays,
      grossPeriodDays: secondPart,
    }
  }

  // FIRST_PERIOD por defecto
  return {
    baseAnnualDays,
    grossPeriodDays: firstPart,
  }
}

/**
 * Motor central de cálculo de retorno de vacaciones IMSS.
 * Considera:
 * 1. Antigüedad y días de periodo (Cláusula 47).
 * 2. Descuento de días a cuenta de vacaciones (`daysOnAccount`).
 * 3. Días de descanso semanal del trabajador (no consumen vacaciones).
 * 4. Días de descanso obligatorio y festivos institucionales (Cláusula 46 y LFT, no consumen vacaciones).
 * 5. Fecha de último día de vacaciones y fecha exacta de reanudación de labores.
 */
export function calculateVacationReturn(input: VacationReturnInput): VacationReturnResult {
  const {
    startDate,
    seniorityYears = 5,
    periodSelection = "FIRST_PERIOD",
    customEntitlementDays,
    daysOnAccount = 0,
    weeklyRestDays = [5, 6], // Sábado (5) y Domingo (6) por defecto
    workScheduleType = "ORDINARY",
    regime = "SEMESTRAL",
  } = input

  const workSchedule: WorkScheduleDefinition = getWorkScheduleForProfile({
    workScheduleType,
    weeklyRestDays,
  })

  const { baseAnnualDays, grossPeriodDays } = getPeriodGrossDays(
    seniorityYears,
    periodSelection,
    customEntitlementDays,
    regime
  )

  const sanitizedDaysOnAccount = Math.max(0, Math.round(daysOnAccount || 0))
  const netVacationDays = Math.max(0, grossPeriodDays - sanitizedDaysOnAccount)

  // Obtener catálogo de días de descanso obligatorio para el año de inicio y siguiente año
  const [startYear] = startDate.split("-").map(Number)
  const restDaysYear1 = getImssMandatoryRestDays(startYear)
  const restDaysYear2 = getImssMandatoryRestDays(startYear + 1)
  const allMandatoryRestDays: ImssMandatoryRestDay[] = [...restDaysYear1, ...restDaysYear2]
  const mandatoryDateMap = new Map<string, string>()
  for (const m of allMandatoryRestDays) {
    mandatoryDateMap.set(m.date, m.title)
  }

  const timeline: VacationDayDetail[] = []
  const mandatoryHolidaysInPeriod: { date: string; title: string }[] = []

  let currentDate = startDate
  let unitsConsumed = 0
  let safetyLoop = 0
  const maxIterations = 365

  // Caso especial: si los días netos son 0 (todos fueron a cuenta de vacaciones)
  if (netVacationDays === 0) {
    const returnDay = findNextWorkDay(
      startDate,
      weeklyRestDays,
      mandatoryDateMap,
      workSchedule
    )
    const formattedStart = formatCivilDateSpanish(startDate)
    const formattedReturn = formatCivilDateSpanish(returnDay)
    const returnDayName = getDayOfWeekName(returnDay)

    return {
      startDate,
      lastVacationDate: startDate,
      returnToWorkDate: returnDay,
      returnDayName,
      lastVacationDayName: getDayOfWeekName(startDate),
      formattedStartDate: formattedStart,
      formattedLastVacationDate: formattedStart,
      formattedReturnDate: formattedReturn,
      baseAnnualDays,
      grossPeriodDays,
      daysOnAccount: sanitizedDaysOnAccount,
      netVacationDays: 0,
      totalCalendarDays: 0,
      weeklyRestDaysCount: 0,
      mandatoryRestDaysCount: 0,
      timeline: [],
      mandatoryHolidaysInPeriod: [],
      summarySentence: `Tus ${grossPeriodDays} días del periodo fueron cubiertos por días a cuenta de vacaciones. Te presentas a laborar el ${returnDayName} ${formattedReturn}.`,
      copyableText: `Vacaciones IMSS: Periodo cubierto íntegramente por días a cuenta de vacaciones (${sanitizedDaysOnAccount} días).\nReanudación de labores: ${returnDayName} ${formattedReturn}.`,
    }
  }

  let weeklyRestCount = 0
  let mandatoryRestCount = 0

  while (unitsConsumed < netVacationDays && safetyLoop < maxIterations) {
    safetyLoop++
    const isRest = isWeeklyRest(currentDate, weeklyRestDays)
    const holidayTitle = mandatoryDateMap.get(currentDate)
    const isMandatory = Boolean(holidayTitle)
    const isWorkable = isWorkDay(currentDate, workSchedule)

    let classification: DayClassification = "VACATION_DAY"

    if (isRest) {
      classification = "WEEKLY_REST"
      weeklyRestCount++
    } else if (isMandatory) {
      classification = "MANDATORY_REST"
      mandatoryRestCount++
      if (!mandatoryHolidaysInPeriod.some((h) => h.date === currentDate)) {
        mandatoryHolidaysInPeriod.push({ date: currentDate, title: holidayTitle! })
      }
    } else if (isWorkable) {
      classification = "VACATION_DAY"
      unitsConsumed++
    } else {
      classification = "WEEKLY_REST"
      weeklyRestCount++
    }

    const [y, m, d] = currentDate.split("-").map(Number)
    const dayOfWeekIndex = getDayOfWeekIndex(currentDate)

    timeline.push({
      date: currentDate,
      dayNumber: d,
      monthNumber: m,
      year: y,
      dayOfWeekIndex,
      dayOfWeekName: SPANISH_DAYS[dayOfWeekIndex],
      formattedDate: formatCivilDateSpanish(currentDate),
      classification,
      holidayTitle: isMandatory ? holidayTitle : undefined,
      isLastVacationDay: unitsConsumed === netVacationDays && classification === "VACATION_DAY",
    })

    if (unitsConsumed < netVacationDays) {
      currentDate = addDaysToCivilDate(currentDate, 1)
    }
  }

  const lastVacationDayDetail = [...timeline].reverse().find((t) => t.classification === "VACATION_DAY")
  const lastVacationDate = lastVacationDayDetail ? lastVacationDayDetail.date : currentDate

  // Encontrar el día exacto de regreso (reanudación de labores)
  // Avanzamos desde el día posterior a lastVacationDate hasta encontrar el primer día laborable
  let inspectingDate = addDaysToCivilDate(lastVacationDate, 1)
  let foundReturn = false
  let returnSafety = 0

  while (!foundReturn && returnSafety < 60) {
    returnSafety++
    const isRest = isWeeklyRest(inspectingDate, weeklyRestDays)
    const holidayTitle = mandatoryDateMap.get(inspectingDate)
    const isMandatory = Boolean(holidayTitle)
    const isWorkable = isWorkDay(inspectingDate, workSchedule)

    if (!isRest && !isMandatory && isWorkable) {
      // Este es el día de regreso
      foundReturn = true
      const [y, m, d] = inspectingDate.split("-").map(Number)
      const dayOfWeekIndex = getDayOfWeekIndex(inspectingDate)

      timeline.push({
        date: inspectingDate,
        dayNumber: d,
        monthNumber: m,
        year: y,
        dayOfWeekIndex,
        dayOfWeekName: SPANISH_DAYS[dayOfWeekIndex],
        formattedDate: formatCivilDateSpanish(inspectingDate),
        classification: "RETURN_TO_WORK",
        isReturnDay: true,
      })
      break
    } else {
      // Es un descanso o festivo contiguo que empalma entre el fin de las vacaciones y el regreso
      let classification: DayClassification = "WEEKLY_REST"
      if (isRest) {
        classification = "WEEKLY_REST"
        weeklyRestCount++
      } else if (isMandatory) {
        classification = "MANDATORY_REST"
        mandatoryRestCount++
        if (!mandatoryHolidaysInPeriod.some((h) => h.date === inspectingDate)) {
          mandatoryHolidaysInPeriod.push({ date: inspectingDate, title: holidayTitle! })
        }
      }

      const [y, m, d] = inspectingDate.split("-").map(Number)
      const dayOfWeekIndex = getDayOfWeekIndex(inspectingDate)

      timeline.push({
        date: inspectingDate,
        dayNumber: d,
        monthNumber: m,
        year: y,
        dayOfWeekIndex,
        dayOfWeekName: SPANISH_DAYS[dayOfWeekIndex],
        formattedDate: formatCivilDateSpanish(inspectingDate),
        classification,
        holidayTitle: isMandatory ? holidayTitle : undefined,
      })

      inspectingDate = addDaysToCivilDate(inspectingDate, 1)
    }
  }

  const returnToWorkDate = inspectingDate
  const returnDayName = getDayOfWeekName(returnToWorkDate)
  const lastVacationDayName = getDayOfWeekName(lastVacationDate)

  const formattedStartDate = formatCivilDateSpanish(startDate)
  const formattedLastVacationDate = formatCivilDateSpanish(lastVacationDate)
  const formattedReturnDate = formatCivilDateSpanish(returnToWorkDate)

  // Total de días naturales de ausencia efectiva (desde startDate hasta el día antes de returnToWorkDate)
  const [sy, sm, sd] = startDate.split("-").map(Number)
  const [ry, rm, rd] = returnToWorkDate.split("-").map(Number)
  const startMs = Date.UTC(sy, sm - 1, sd)
  const returnMs = Date.UTC(ry, rm - 1, rd)
  const totalCalendarDays = Math.max(1, Math.round((returnMs - startMs) / (1000 * 60 * 60 * 24)))

  const summarySentence = `Disfrutas ${netVacationDays} días hábiles de vacaciones del ${formattedStartDate} al ${formattedLastVacationDate}. Con ${weeklyRestCount} descansos semanales y ${mandatoryRestCount} descansos obligatorios, gozas de ${totalCalendarDays} días naturales continuos. Te presentas a laborar el ${returnDayName} ${formattedReturnDate}.`

  const copyableText = [
    `SOLICITUD DE PROGRAMACIÓN DE VACACIONES (IMSS CCT)`,
    `• Fecha de inicio: ${getDayOfWeekName(startDate)} ${formattedStartDate}`,
    `• Último día de vacaciones: ${lastVacationDayName} ${formattedLastVacationDate}`,
    `• Días hábiles a disfrutar: ${netVacationDays} días hábiles`,
    sanitizedDaysOnAccount > 0 ? `• Días a cuenta de vacaciones descontados: ${sanitizedDaysOnAccount} días` : null,
    `• Descansos semanales intermedios: ${weeklyRestCount} días`,
    mandatoryRestCount > 0
      ? `• Descansos obligatorios / festivos incluidos: ${mandatoryHolidaysInPeriod.map((h) => `${h.title} (${h.date})`).join(", ")}`
      : null,
    `• REANUDACIÓN DE LABORES (FECHA DE REGRESO): ${returnDayName} ${formattedReturnDate}`,
    `• Total de días naturales de descanso continuo: ${totalCalendarDays} días naturales`,
  ]
    .filter(Boolean)
    .join("\n")

  return {
    startDate,
    lastVacationDate,
    returnToWorkDate,
    returnDayName,
    lastVacationDayName,
    formattedStartDate,
    formattedLastVacationDate,
    formattedReturnDate,
    baseAnnualDays,
    grossPeriodDays,
    daysOnAccount: sanitizedDaysOnAccount,
    netVacationDays,
    totalCalendarDays,
    weeklyRestDaysCount: weeklyRestCount,
    mandatoryRestDaysCount: mandatoryRestCount,
    timeline,
    mandatoryHolidaysInPeriod,
    summarySentence,
    copyableText,
  }
}

function findNextWorkDay(
  afterDate: string,
  weeklyRestDays: number[],
  mandatoryDateMap: Map<string, string>,
  schedule: WorkScheduleDefinition
): string {
  let inspecting = addDaysToCivilDate(afterDate, 1)
  let attempts = 0
  while (attempts < 60) {
    attempts++
    const isRest = isWeeklyRest(inspecting, weeklyRestDays)
    const isMandatory = mandatoryDateMap.has(inspecting)
    const isWorkable = isWorkDay(inspecting, schedule)
    if (!isRest && !isMandatory && isWorkable) {
      return inspecting
    }
    inspecting = addDaysToCivilDate(inspecting, 1)
  }
  return inspecting
}
