/**
 * Decodificador de incidencias, fechas y formatos numéricos del SIAP (IMSS).
 *
 * En los tarjetones de pago del IMSS (SIAP/NOA), las fechas de incidencias
 * (guardias, tiempos extras, faltas, retardos, sustituciones T.A.T., vacaciones)
 * aparecen en la sección inferior de OBSERVACIONES como cadenas numéricas compactas:
 * - 8 dígitos: AAAAMMDD (ej. 20260614) o DDMMYYYY
 * - 6 dígitos: AAMMDD (ej. 260614) o DDMMAA
 * - 7 dígitos (vencimiento / quincena): AAAASSS (ej. 2026014 = Quincena 14 del 2026)
 * - Renglones concatenados con matrícula o turnos (ej. 98765432-20260614).
 *
 * Este módulo contiene funciones puras para traducir esos códigos a fechas
 * legibles en español con día de la semana y explicaciones laborales claras.
 */

import type { GuideObservation, GuidePayslip, GuidePayslipLine } from "./types"
import { isValidMexicanCivilDate, formatCivilIsoDate } from "@/features/tarjeton/lib/imss-date-parser"
import { normalizeCode } from "./normalize"

export const SPANISH_MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

export const SPANISH_DAY_NAMES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
]

export interface DecodedSiapDate {
  isoDate: string
  formatted: string
  dayOfWeek: string
  day: number
  month: number
  year: number
}

export interface DecodedSiapFortnight {
  year: number
  fortnight: number
  label: string
  shortLabel: string
  month: number
  half: 1 | 2
}

export interface PayslipPeriodDetails {
  year: number
  month: number
  half: 1 | 2
  fortnight: number
  label: string
  shortLabel: string
  dateRangeText: string
  estimatedPaymentDate: string
  laggingFortnight: {
    year: number
    month: number
    half: 1 | 2
    fortnight: number
    label: string
    shortLabel: string
    dateRangeText: string
    lagDescription?: string
  }
}

export type GuardiaTiming = "past" | "future" | "current" | "unspecified"

export interface GuardiaInfo {
  code: string
  conceptName: string
  amount: number
  date?: DecodedSiapDate
  dateRange?: DecodedSiapDateRange
  fortnight?: DecodedSiapFortnight
  dateRaw?: string
  units?: number
  unitType: "horas" | "dias" | "guardia"
  shiftType?: string
  partnerMatricula?: string
  summary: string
  incidenceText?: string
  timing?: GuardiaTiming
  timingStatusLabel?: string
  actionAdvice?: string
}

export interface FaltaInfo {
  code: string
  conceptName?: string
  amount: number
  date?: DecodedSiapDate
  dateRange?: DecodedSiapDateRange
  fortnight?: DecodedSiapFortnight
  dateRaw?: string
  units?: number
  summary: string
  incidenceText?: string
  impactOnIncentives: boolean
  statusLabel?: string
  actionAdvice?: string
}

export interface VacacionesInfo {
  hasVacaciones: boolean
  primaAmount?: number
  ayudaAmount?: number
  daysPaid?: number
  departureDate?: DecodedSiapDate
  endDate?: DecodedSiapDate
  returnDate?: DecodedSiapDate
  summary: string
}

export interface RetroactivoInfo {
  code: string
  description: string
  amount: number
  targetPeriod?: string
  notes?: string
  summary: string
}

/** Formatea componentes de fecha a texto largo en español: "domingo 14 de junio de 2026". */
export function formatSpanishDate(day: number, month: number, year: number): DecodedSiapDate {
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dayOfWeek = SPANISH_DAY_NAMES[d.getUTCDay()]
  const monthName = SPANISH_MONTH_NAMES[month - 1]
  const isoDate = formatCivilIsoDate(day, month, year)
  return {
    isoDate,
    formatted: `${dayOfWeek} ${day} de ${monthName} de ${year}`,
    dayOfWeek,
    day,
    month,
    year,
  }
}

/** Suma días calendario a una fecha y devuelve la fecha resultante. */
export function addDaysToDate(year: number, month: number, day: number, daysToAdd: number): DecodedSiapDate {
  const d = new Date(Date.UTC(year, month - 1, day + daysToAdd, 12, 0, 0))
  return formatSpanishDate(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear())
}

/**
 * Decodifica una cadena o código numérico SIAP a fecha civil con día de la semana.
 * Acepta:
 * - 8 dígitos AAAAMMDD (ej. 20260614)
 * - 8 dígitos DDMMYYYY (ej. 14062026)
 * - 6 dígitos AAMMDD (ej. 260614)
 * - 6 dígitos DDMMAA (ej. 140626)
 * - Con separadores: 14/06/2026, 2026-06-14, 14-JUN-2026
 * - Extrae la fecha si viene dentro de texto libre (ej. "GUARDIA 20260614 MAT 98765432").
 */
export function decodeSiapDate(raw: string | null | undefined): DecodedSiapDate | null {
  if (!raw) return null
  const text = String(raw).trim().toUpperCase()
  if (!text) return null

  // 1. Con separadores ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2])
    const d = Number(isoMatch[3])
    if (isValidMexicanCivilDate(d, m, y)) return formatSpanishDate(d, m, y)
  }

  // 2. Con separadores civiles DD/MM/AAAA o DD-MM-AAAA
  const civMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/)
  if (civMatch) {
    const d = Number(civMatch[1])
    const m = Number(civMatch[2])
    const y = Number(civMatch[3])
    if (isValidMexicanCivilDate(d, m, y)) return formatSpanishDate(d, m, y)
  }

  // 3. Mes nombrado en texto: "14-JUN-2026" o "14 JUN 2026"
  const MONTHS_MAP: Record<string, number> = {
    ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
    JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
  }
  const namedMatch = text.match(/\b(\d{1,2})[\/\-.\s](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\w*[\/\-.\s]?(20\d{2})\b/)
  if (namedMatch) {
    const d = Number(namedMatch[1])
    const m = MONTHS_MAP[namedMatch[2].slice(0, 3)]
    const y = Number(namedMatch[3])
    if (m && isValidMexicanCivilDate(d, m, y)) return formatSpanishDate(d, m, y)
  }

  // 4. Compacto de 8 dígitos continuo: AAAAMMDD preferente (ej. 20260614)
  const eightDigitMatches = text.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)
  for (const match of eightDigitMatches) {
    const y = Number(match[1])
    const m = Number(match[2])
    const d = Number(match[3])
    if (isValidMexicanCivilDate(d, m, y)) {
      return formatSpanishDate(d, m, y)
    }
  }

  // 4b. Compacto de 8 dígitos DDMMYYYY (ej. 14062026)
  const eightReverseMatches = text.matchAll(/\b(\d{2})(\d{2})(20\d{2})\b/g)
  for (const match of eightReverseMatches) {
    const d = Number(match[1])
    const m = Number(match[2])
    const y = Number(match[3])
    if (isValidMexicanCivilDate(d, m, y)) {
      return formatSpanishDate(d, m, y)
    }
  }

  // 5. Compacto de 6 dígitos: DDMMAA (ej. 160926 -> 16 de septiembre de 2026)
  // En México y el IMSS, DDMMAA es sumamente común cuando el año son dos dígitos (24 a 35).
  const sixDigitDdmmaaMatches = text.matchAll(/\b(\d{2})(\d{2})(2[4-9]|3[0-5])\b/g)
  for (const match of sixDigitDdmmaaMatches) {
    const d = Number(match[1])
    const m = Number(match[2])
    const yy = Number(match[3])
    const y = 2000 + yy
    if (isValidMexicanCivilDate(d, m, y)) {
      return formatSpanishDate(d, m, y)
    }
  }

  // 5b. Compacto de 6 dígitos: AAMMDD (ej. 260916 -> 16 de septiembre de 2026)
  const sixDigitMatches = text.matchAll(/\b(2[4-9]|3[0-5])(\d{2})(\d{2})\b/g)
  for (const match of sixDigitMatches) {
    const yy = Number(match[1])
    const m = Number(match[2])
    const d = Number(match[3])
    const y = 2000 + yy
    if (isValidMexicanCivilDate(d, m, y)) {
      return formatSpanishDate(d, m, y)
    }
  }

  return null
}

export interface DecodedSiapDateRange {
  startDate: DecodedSiapDate
  endDate: DecodedSiapDate
  formatted: string
  isSingleDay: boolean
}

/**
 * Decodifica rangos de fechas SIAP en observaciones, por ejemplo:
 * - "16092026-16092026" (mismo día: miércoles 16 de septiembre de 2026)
 * - "15092026-16092026" (rango: del martes 15 al miércoles 16 de septiembre de 2026)
 * - "DEL 20260701 AL 20260715"
 */
export function decodeSiapDateRange(raw: string | null | undefined): DecodedSiapDateRange | null {
  if (!raw) return null
  const text = String(raw).trim().toUpperCase()
  if (!text) return null

  // Buscar dos fechas separadas por guión, "AL", "A"
  const rangeMatch = text.match(/(\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[-ALa\s]+\s*(\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
  if (rangeMatch) {
    const d1 = decodeSiapDate(rangeMatch[1])
    const d2 = decodeSiapDate(rangeMatch[2])
    if (d1 && d2) {
      const isSingleDay = d1.isoDate === d2.isoDate
      const formatted = isSingleDay
        ? d1.formatted
        : `del ${d1.dayOfWeek} ${d1.day} de ${SPANISH_MONTH_NAMES[d1.month - 1]} al ${d2.dayOfWeek} ${d2.day} de ${SPANISH_MONTH_NAMES[d2.month - 1]} de ${d2.year}`
      return {
        startDate: d1,
        endDate: d2,
        formatted,
        isSingleDay,
      }
    }
  }

  // Si solo viene una fecha única
  const single = decodeSiapDate(text)
  if (single) {
    return {
      startDate: single,
      endDate: single,
      formatted: single.formatted,
      isSingleDay: true,
    }
  }

  return null
}

/**
 * Decodifica leyendas de Quincena de Incidencia en observaciones, por ejemplo "QI 18" o "QI18".
 */
export function decodeQiFortnight(raw: string | null | undefined, referenceYear = 2026): DecodedSiapFortnight | null {
  if (!raw) return null
  const match = String(raw).trim().match(/\bQI\s*0?([0-2]?\d)\b/i)
  if (!match) return null
  const qNum = Number(match[1])
  if (qNum < 1 || qNum > 24) return null
  const year = referenceYear
  const month = Math.ceil(qNum / 2)
  const half: 1 | 2 = qNum % 2 === 1 ? 1 : 2
  const monthName = SPANISH_MONTH_NAMES[month - 1]
  const halfLabel = half === 1 ? "1.ª" : "2.ª"

  return {
    year,
    fortnight: qNum,
    label: `${halfLabel} quincena de ${monthName} de ${year} (Quincena ${qNum})`,
    shortLabel: `${halfLabel} de ${monthName} ${year}`,
    month,
    half,
  }
}

/**
 * Decodifica una quincena SIAP de 7 dígitos: AAAASSS (ej. "2026014" -> Quincena 14 de 2026 = 2ª de Julio)
 * o formatos estándar como "202614", "2026/14".
 */
export function decodeSiapFortnight(raw: string | null | undefined): DecodedSiapFortnight | null {
  if (!raw) return null
  const str = String(raw).trim()
  const match = str.match(/\b(20\d{2})[/_-]?0?([0-2]?\d)\b/)
  if (!match) return null

  const year = Number(match[1])
  const fortnight = Number(match[2])
  if (fortnight < 1 || fortnight > 24) return null

  const month = Math.ceil(fortnight / 2)
  const half: 1 | 2 = fortnight % 2 === 1 ? 1 : 2
  const monthName = SPANISH_MONTH_NAMES[month - 1]
  const halfLabel = half === 1 ? "1.ª" : "2.ª"

  return {
    year,
    fortnight,
    label: `${halfLabel} quincena de ${monthName} de ${year}`,
    shortLabel: `${halfLabel} de ${monthName} ${year}`,
    month,
    half,
  }
}

/**
 * Parsea el periodo de pago del tarjetón actual y calcula el rango de fechas,
 * la fecha estimada de pago y la quincena previa evaluada (para desfase reglamentario de estímulos).
 */
export function parsePayslipPeriod(raw?: string | null): PayslipPeriodDetails | null {
  if (!raw) return null
  const str = String(raw).trim()

  let year: number | undefined
  let month: number | undefined
  let half: (1 | 2) | undefined
  let fortnight: number | undefined

  // 1. Formato estilo "2A-OCT-2026", "1A-OCT-26", "2ª QNA · JULIO 2026"
  const halfMonthMatch = str.match(/\b([12])[Aaªº]?[\s/._-]+(?:QNA|QUINCENA)?[\s/._-]*([A-Za-z]{3,12})[\s/._-]+(\d{2,4})\b/i)
  if (halfMonthMatch) {
    half = Number(halfMonthMatch[1]) as 1 | 2
    const monthStr = halfMonthMatch[2].toLowerCase()
    const rawYear = Number(halfMonthMatch[3])
    year = rawYear < 100 ? 2000 + rawYear : rawYear

    const MONTH_MAP: Record<string, number> = {
      ene: 1, jan: 1, enero: 1,
      feb: 2, febrero: 2,
      mar: 3, marzo: 3,
      abr: 4, apr: 4, abril: 4,
      may: 5, mayo: 5,
      jun: 6, junio: 6,
      jul: 7, julio: 7,
      ago: 8, aug: 8, agosto: 8,
      sep: 9, set: 9, sept: 9, septiembre: 9,
      oct: 10, octubre: 10,
      nov: 11, noviembre: 11,
      dic: 12, dec: 12, diciembre: 12,
    }

    for (const [key, num] of Object.entries(MONTH_MAP)) {
      if (monthStr.startsWith(key)) {
        month = num
        break
      }
    }
  }

  // 2. Formato por quincena: "2026/18", "2026-18", "2026018", "Q18 2026"
  if (!month || !year || !half) {
    const qMatch = str.match(/\b(?:Q)?(20\d{2})[/_-]?0?([0-2]?\d)\b/i) || str.match(/\bQ([0-2]?\d)[\s/_-]+(20\d{2})\b/i)
    if (qMatch) {
      const isReversed = qMatch[0].toUpperCase().startsWith("Q") && Number(qMatch[1]) <= 24
      const qYear = isReversed ? Number(qMatch[2]) : Number(qMatch[1])
      const qNum = isReversed ? Number(qMatch[1]) : Number(qMatch[2])
      if (qNum >= 1 && qNum <= 24) {
        year = qYear
        fortnight = qNum
        month = Math.ceil(qNum / 2)
        half = qNum % 2 === 1 ? 1 : 2
      }
    }
  }

  if (!year || !month || !half) return null

  if (!fortnight) {
    fortnight = (month - 1) * 2 + half
  }

  const monthName = SPANISH_MONTH_NAMES[month - 1]
  const halfLabel = half === 1 ? "1.ª" : "2.ª"
  const label = `${halfLabel} quincena de ${monthName} de ${year} (Quincena ${fortnight})`
  const shortLabel = `${halfLabel} de ${monthName} ${year}`

  const daysInMonth = new Date(year, month, 0).getDate()
  const dateRangeText = half === 1 ? `Del 1 al 15 de ${monthName} de ${year}` : `Del 16 al ${daysInMonth} de ${monthName} de ${year}`
  const estimatedPaymentDate = half === 1 ? `14 o 15 de ${monthName} de ${year}` : `Día ${daysInMonth - 1} o ${daysInMonth} de ${monthName} de ${year}`

  // En el IMSS, el SIAP evalúa las incidencias y estímulos con 1 mes de atraso (desfase N-2, Campo 30)
  let prevYear = year
  let prevFortnight = fortnight - 2
  if (prevFortnight <= 0) {
    prevYear = year - 1
    prevFortnight = 24 + prevFortnight
  }
  const prevMonth = Math.ceil(prevFortnight / 2)
  const prevHalf: 1 | 2 = prevFortnight % 2 === 1 ? 1 : 2
  const prevMonthName = SPANISH_MONTH_NAMES[prevMonth - 1]
  const prevHalfLabel = prevHalf === 1 ? "1.ª" : "2.ª"
  const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate()
  const prevDateRange = prevHalf === 1 ? `del 1 al 15 de ${prevMonthName}` : `del 16 al ${prevDaysInMonth} de ${prevMonthName}`

  return {
    year,
    month,
    half,
    fortnight,
    label,
    shortLabel,
    dateRangeText,
    estimatedPaymentDate,
    laggingFortnight: {
      year: prevYear,
      month: prevMonth,
      half: prevHalf,
      fortnight: prevFortnight,
      label: `${prevHalfLabel} quincena de ${prevMonthName} de ${prevYear} (Quincena ${prevFortnight})`,
      shortLabel: `${prevHalfLabel} de ${prevMonthName} ${prevYear}`,
      dateRangeText: `${prevDateRange} de ${prevYear}`,
      lagDescription: "1 mes de atraso institucional (corte SIAP N-2, Campo 30)",
    },
  }
}

export function determineGuardiaTiming(
  incidenceDate: DecodedSiapDate | undefined,
  periodDetails?: PayslipPeriodDetails | null
): { timing: GuardiaTiming; timingStatusLabel: string; actionAdvice: string } {
  if (!incidenceDate || !periodDetails) {
    return {
      timing: "unspecified",
      timingStatusLabel: "Guardia registrada en nómina",
      actionAdvice: "En este tarjetón te pagaron tu guardia. Como en el comprobante no viene impreso el día exacto en notas, verifica en tu tarjeta de control o rol institucional la fecha en que la cubriste o tienes programada para asegurar que no te quede ningún día pendiente.",
    }
  }

  const incYear = incidenceDate.year
  const incMonth = incidenceDate.month
  const incDay = incidenceDate.day

  const payYear = periodDetails.year
  const payMonth = periodDetails.month
  const payHalf = periodDetails.half

  const startDayOfPayPeriod = payHalf === 1 ? 1 : 16
  const endDayOfPayPeriod = payHalf === 1 ? 15 : new Date(payYear, payMonth, 0).getDate()

  const incTime = new Date(incYear, incMonth - 1, incDay).getTime()
  const payStartTime = new Date(payYear, payMonth - 1, startDayOfPayPeriod).getTime()
  const payEndTime = new Date(payYear, payMonth - 1, endDayOfPayPeriod, 23, 59, 59).getTime()

  if (incTime < payStartTime) {
    return {
      timing: "past",
      timingStatusLabel: "✅ Ya cobrada / Pagada (No requieres reclamación)",
      actionAdvice: `Esta guardia fue el ${incidenceDate.formatted}, la cual ya laboraste previamente. Al estar pagada en este tarjetón, tu pago está al corriente y NO necesitas meter reporte de reclamación sindical ni inconformidad de nómina.`,
    }
  } else if (incTime > payEndTime) {
    return {
      timing: "future",
      timingStatusLabel: "⏰ Guardia programada (Te la pagaron por adelantado)",
      actionAdvice: `Esta guardia te la pagaron por adelantado y corresponde al ${incidenceDate.formatted}. Recuerda que debes acudir a laborar tu guardia en esa fecha señalada.`,
    }
  } else {
    return {
      timing: "current",
      timingStatusLabel: "📌 Guardia de la quincena actual",
      actionAdvice: `Esta guardia corresponde a esta misma quincena (${incidenceDate.formatted}) y ya está liquidada en este talón.`,
    }
  }
}

/**
 * Interpreta detalles de guardias y tiempo extra (Conceptos 037, 076, 176, etc.).
 */
export function decodeGuardiaDetails(
  observations: GuideObservation[],
  line?: GuidePayslipLine,
  periodDetails?: PayslipPeriodDetails | null
): GuardiaInfo | null {
  const normTarget = normalizeCode(line?.code) ?? line?.code ?? "035"
  const isHorasExtra =
    normTarget === "037" ||
    Boolean(line?.description?.toLowerCase().includes("tiempo extra")) ||
    Boolean(line?.description?.toLowerCase().includes("extraordinari"))
  const isGuardia =
    normTarget === "035" ||
    normTarget === "076" ||
    normTarget === "176" ||
    Boolean(line?.description?.toLowerCase().includes("guardia"))

  if (!isHorasExtra && !isGuardia) {
    return null
  }

  // Buscar observaciones que correspondan a este concepto
  const matchingObs = observations.filter((o) => {
    const oCode = normalizeCode(o.conceptCode)
    if (oCode === normTarget) return true
    if (isHorasExtra && oCode === "037") return true
    if (isGuardia && normTarget === "035" && oCode === "035") return true
    if (normTarget === "076" && oCode === "076") return true
    if (normTarget === "176" && oCode === "176") return true
    return false
  })

  // Búsqueda de respaldo en observaciones huérfanas o con código incompleto
  if (matchingObs.length === 0 && (isHorasExtra || isGuardia)) {
    for (const o of observations) {
      const text = `${o.conceptCode || ""} ${o.notes || ""} ${o.controlNumber || ""}`.toUpperCase()
      if (isHorasExtra && (text.includes("037") || text.includes("TIEMPO EXTRA") || text.includes("HRS") || text.includes("EXTRAORDINARI"))) {
        matchingObs.push(o)
      } else if (isGuardia && normTarget === "035" && (text.includes("035") || text.includes("GUARDIA"))) {
        matchingObs.push(o)
      }
    }
  }

  const obs = matchingObs[0]
  const amount = line?.amount ?? obs?.amount ?? 0

  // 1. Extraer unidades (horas extra o jornadas/guardias)
  let units: number | undefined
  let unitSum = 0
  let foundAnyUnits = false
  for (const o of matchingObs) {
    let u = o.units
    if (u == null && o.duePeriod) {
      const n = Number(o.duePeriod)
      if (Number.isInteger(n) && n > 0 && n <= 48 && !/^(19|20)\d{4,6}$/.test(o.duePeriod)) {
        u = n
      }
    }
    if (u == null && o.controlNumber) {
      const n = Number(o.controlNumber)
      if (Number.isInteger(n) && n > 0 && n <= 48 && !/^(19|20)\d{2}/.test(o.controlNumber) && !/^\d{7,8}$/.test(o.controlNumber)) {
        u = n
      }
    }
    if (u == null && o.notes) {
      const m = o.notes.match(/\b(\d+(?:\.\d+)?)\s*(?:HORAS?|HRS?|DIAS?|UDS?|UNIDADES?)\b/i)
      if (m) {
        u = Number(m[1])
      } else if (isHorasExtra) {
        // En tiempo extra, buscar entero aislado en notas sin confundir con importes monetarios
        const textWithoutMoney = o.notes.replace(/\b-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g, " ")
        const tokens = textWithoutMoney.split(/[\s;:\/\-]+/)
        for (const tok of tokens) {
          const n = Number(tok)
          if (Number.isInteger(n) && n > 0 && n <= 48 && !/^(19|20)\d{2}$/.test(tok) && tok.length <= 2) {
            u = n
            break
          }
        }
      }
    }
    if (u != null && Number.isFinite(u) && u > 0) {
      unitSum += u
      foundAnyUnits = true
    }
  }

  // Fallback con la descripción de la línea si no vino en observaciones
  if (!foundAnyUnits && line?.description) {
    const m = line.description.match(/\b(\d+(?:\.\d+)?)\s*(?:HORAS?|HRS?|DIAS?|UDS?|UNIDADES?)\b/i)
    if (m) {
      const val = Number(m[1])
      if (Number.isFinite(val) && val > 0 && val <= 48) {
        unitSum = Math.round(val)
        foundAnyUnits = true
      }
    }
  }

  if (foundAnyUnits) {
    units = unitSum
  }

  const unitType: "horas" | "dias" | "guardia" = isHorasExtra
    ? "horas"
    : units != null && units <= 24
    ? "horas"
    : "guardia"

  // 2. Extraer rango o fecha civil exacta desde notes, controlNumber o description a lo largo de las observaciones
  let dateRange: DecodedSiapDateRange | null = null
  let date: DecodedSiapDate | null = null
  let fortnight: DecodedSiapFortnight | null = null

  const collectedDates: DecodedSiapDate[] = []

  for (const o of matchingObs) {
    const dr = decodeSiapDateRange(o.notes) || decodeSiapDateRange(o.controlNumber)
    if (dr) {
      if (!dateRange && !dr.isSingleDay) dateRange = dr
      if (!collectedDates.some((d) => d.isoDate === dr.startDate.isoDate)) collectedDates.push(dr.startDate)
      if (!dr.isSingleDay && !collectedDates.some((d) => d.isoDate === dr.endDate.isoDate)) collectedDates.push(dr.endDate)
    } else {
      const sd = decodeSiapDate(o.controlNumber) ?? decodeSiapDate(o.notes)
      if (sd && !collectedDates.some((d) => d.isoDate === sd.isoDate)) {
        collectedDates.push(sd)
      }
    }

    if (!fortnight) {
      fortnight =
        decodeQiFortnight(o.notes, periodDetails?.year ?? 2026) ||
        decodeQiFortnight(o.controlNumber, periodDetails?.year ?? 2026) ||
        decodeSiapFortnight(o.notes) ||
        decodeSiapFortnight(o.controlNumber) ||
        decodeSiapFortnight(o.duePeriod)
    }
  }

  if (collectedDates.length === 1) {
    date = collectedDates[0]
  } else if (collectedDates.length > 1) {
    collectedDates.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    const first = collectedDates[0]
    const last = collectedDates[collectedDates.length - 1]
    date = first
    dateRange = {
      startDate: first,
      endDate: last,
      formatted: `del ${first.dayOfWeek} ${first.day} de ${SPANISH_MONTH_NAMES[first.month - 1]} al ${last.dayOfWeek} ${last.day} de ${SPANISH_MONTH_NAMES[last.month - 1]} de ${last.year}`,
      isSingleDay: false,
    }
  }

  // Fallback con la descripción o notas de la línea
  if (!dateRange && !date) {
    dateRange = decodeSiapDateRange(line?.description)
    date = dateRange?.startDate ?? decodeSiapDate(line?.description)
  }
  if (!date && !fortnight) {
    fortnight =
      decodeQiFortnight(line?.description, periodDetails?.year ?? 2026) ||
      decodeSiapFortnight(line?.description)
  }

  // Turno o tipo de guardia
  let shiftType: string | undefined
  const noteUpper = `${obs?.notes ?? ""} ${line?.description ?? ""}`.toUpperCase()
  if (noteUpper.includes("NOCTURN") || noteUpper.includes("T3") || noteUpper.includes("G3")) shiftType = "nocturna"
  else if (noteUpper.includes("MATUTIN") || noteUpper.includes("T1") || noteUpper.includes("G1")) shiftType = "matutina"
  else if (noteUpper.includes("VESPERTIN") || noteUpper.includes("T2") || noteUpper.includes("G2")) shiftType = "vespertina"
  else if (noteUpper.includes("ACUMULAD") || noteUpper.includes("JA")) shiftType = "jornada acumulada"
  else if (noteUpper.includes("FESTIV") || noteUpper.includes("DESCANSO")) shiftType = "en día festivo / descanso"

  // Si es Convenio T.A.T. (076 o 176), buscar matrícula del compañero
  let partnerMatricula: string | undefined
  for (const o of matchingObs) {
    if (o.controlNumber && /^\d{7,8}$/.test(o.controlNumber.trim())) {
      const rawNum = o.controlNumber.trim()
      if (!decodeSiapDate(rawNum)) {
        partnerMatricula = rawNum
        break
      }
    }
    if (!partnerMatricula && o.notes) {
      const matExplicit = o.notes.match(/\b(?:MAT|MATRICULA|COMP|TITULAR)[\s.:]+(\d{7,8})\b/i)
      if (matExplicit) {
        partnerMatricula = matExplicit[1]
        break
      } else {
        const anyNum = o.notes.match(/\b(\d{7,8})\b/)
        if (anyNum && !decodeSiapDate(anyNum[1])) {
          partnerMatricula = anyNum[1]
          break
        }
      }
    }
  }

  const timingInfo = determineGuardiaTiming((dateRange?.startDate ?? date) ?? undefined, periodDetails)

  // Texto amigable de incidencia
  let incidenceText = ""
  if (isHorasExtra) {
    const hoursLabel = units ? ` (${units} ${units === 1 ? "hora extra" : "horas extra"})` : ""
    if (dateRange && !dateRange.isSingleDay) {
      incidenceText = `Horas extra laboradas: ${dateRange.formatted}${hoursLabel}`
    } else if (date) {
      incidenceText = `Horas extra laboradas el: ${date.formatted}${hoursLabel}`
    } else if (fortnight) {
      incidenceText = `Horas extra devengadas en la ${fortnight.label}${hoursLabel}`
    } else if (units) {
      incidenceText = `Tiempo extraordinario amparado en este comprobante: ${units} horas extra`
    } else {
      incidenceText = "Tiempo extraordinario amparado en este comprobante"
    }
  } else {
    const unitsLabel = units ? ` (${units} ${unitType})` : ""
    if (dateRange && !dateRange.isSingleDay) {
      incidenceText = `Guardia laborada: ${dateRange.formatted}${unitsLabel}`
    } else if (date) {
      incidenceText = `Guardia ${timingInfo.timing === "future" ? "programada para el" : "laborada el"}: ${date.formatted}${unitsLabel}`
    } else if (fortnight) {
      incidenceText = `Guardia devengada en la ${fortnight.label}${unitsLabel}`
    } else if (units) {
      incidenceText = `Guardia amparada en este talón (${units} ${unitType})`
    } else {
      incidenceText = "Guardia amparada en este talón"
    }
  }

  // Generar resumen en lenguaje natural
  let summary = ""
  const conceptName =
    isHorasExtra
      ? "Tiempo Extraordinario"
      : normTarget === "035"
      ? "Guardias"
      : normTarget === "076"
      ? "Guardia Convenio T.A.T."
      : normTarget === "176"
      ? "Deducción Permuta T.A.T."
      : "Tiempo Extraordinario / Guardia"

  if (isHorasExtra) {
    const hoursText = units ? `${units} ${units === 1 ? "hora extra" : "horas extra"}` : "tiempo extraordinario"
    summary = `Te pagaron $${amount.toLocaleString("es-MX")} por concepto de ${hoursText} (Concepto 037 · Tiempo Extraordinario)${shiftType ? ` en turno ${shiftType}` : ""}`
    if (dateRange && !dateRange.isSingleDay) {
      summary += ` laboradas del ${dateRange.formatted}.`
    } else if (date) {
      summary += ` laboradas el ${date.formatted}.`
    } else if (fortnight) {
      summary += ` devengadas en la ${fortnight.label}.`
    } else {
      summary += ` conforme a las Cláusulas 32 y 33 del CCT.`
    }
    if (timingInfo.timing === "past") {
      summary += " Este tiempo extraordinario ya fue laborado y cubierto en esta quincena (no requiere reclamación sindical)."
    }
  } else if (normTarget === "076") {
    summary = `Cubriste una guardia por Convenio Trabajador a Trabajador (T.A.T.)${shiftType ? ` en turno ${shiftType}` : ""}`
    if (dateRange) summary += ` el ${dateRange.formatted}`
    else if (date) summary += ` el ${date.formatted}`
    else if (fortnight) summary += ` de la ${fortnight.label}`
    if (partnerMatricula) summary += ` (matrícula sustituida: ${partnerMatricula})`
    summary += `. Te depositaron $${amount.toLocaleString("es-MX")}.`
  } else if (normTarget === "176") {
    summary = `Descuento por guardia cedida bajo Convenio T.A.T.`
    if (dateRange) summary += ` programada el ${dateRange.formatted}`
    else if (date) summary += ` programada el ${date.formatted}`
    else if (fortnight) summary += ` de la ${fortnight.label}`
    summary += `. Importe deducido: $${Math.abs(amount).toLocaleString("es-MX")}.`
  } else {
    // 035
    summary = `Te pagaron ${units ? `${units} ${unitType}` : "tu guardia"} por concepto de Guardias (035)${shiftType ? ` en turno ${shiftType}` : ""}`
    if (dateRange && !dateRange.isSingleDay) summary += ` ${timingInfo.timing === "future" ? "programada del" : "laborada del"} ${dateRange.formatted}`
    else if (date) summary += ` ${timingInfo.timing === "future" ? "programada para el" : "laborada el"} ${date.formatted}`
    else if (fortnight) summary += ` generada en la ${fortnight.label}`
    summary += ` por un importe de $${amount.toLocaleString("es-MX")}.`

    if (timingInfo.timing === "past") {
      summary += " Esta guardia ya fue laborada y pagada en este comprobante (no requiere reclamación sindical)."
    } else if (timingInfo.timing === "future") {
      summary += " Esta guardia se te pagó por adelantado; recuerda acudir a laborar en la fecha señalada."
    }
  }

  return {
    code: normTarget,
    conceptName,
    amount,
    date: date ?? undefined,
    dateRange: dateRange ?? undefined,
    fortnight: fortnight ?? undefined,
    dateRaw: obs?.controlNumber || obs?.notes || obs?.duePeriod,
    units,
    unitType,
    shiftType,
    partnerMatricula,
    summary,
    incidenceText,
    timing: timingInfo.timing,
    timingStatusLabel: timingInfo.timingStatusLabel,
    actionAdvice: timingInfo.actionAdvice,
  }
}

const FALTA_CODES = new Set(["172", "171", "129", "173", "174", "161", "164", "175"])

/**
 * Interpreta detalles de faltas injustificadas (172), licencias sin sueldo (171, 129),
 * retardos (174) y ausentismos sancionados.
 */
export function decodeFaltaDetails(
  observations: GuideObservation[],
  line?: GuidePayslipLine,
  periodDetails?: PayslipPeriodDetails | null
): FaltaInfo | null {
  const normTarget = normalizeCode(line?.code) ?? line?.code ?? "172"
  const isTargetFalta =
    FALTA_CODES.has(normTarget) ||
    Boolean(line?.description?.toLowerCase().includes("falta")) ||
    Boolean(line?.description?.toLowerCase().includes("licencia sin sueldo")) ||
    Boolean(line?.description?.toLowerCase().includes("retardo"))

  if (!isTargetFalta) {
    return null
  }

  // Buscar todas las observaciones que correspondan a este concepto
  const matchingObs = observations.filter((o) => {
    const oCode = normalizeCode(o.conceptCode)
    if (oCode === normTarget) return true
    if (FALTA_CODES.has(normTarget) && oCode && FALTA_CODES.has(oCode)) return true
    const text = `${o.conceptCode || ""} ${o.notes || ""} ${o.controlNumber || ""}`.toUpperCase()
    if (
      text.includes("FALTA") ||
      text.includes("172") ||
      text.includes("LICENCIA SIN SUELDO") ||
      text.includes("171") ||
      text.includes("129") ||
      text.includes("RETARDO") ||
      text.includes("174")
    ) {
      return true
    }
    return false
  })

  const obs = matchingObs[0]
  const amount = Math.abs(line?.amount ?? obs?.amount ?? 0)

  // 1. Extraer unidades (días de falta o retardos)
  let units = 0
  let foundUnits = false
  for (const o of matchingObs) {
    let u = o.units
    if (u == null && o.duePeriod) {
      const n = Number(o.duePeriod)
      if (Number.isInteger(n) && n > 0 && n <= 30 && !/^(19|20)\d{4,6}$/.test(o.duePeriod)) u = n
    }
    if (u == null && o.controlNumber) {
      const n = Number(o.controlNumber)
      if (Number.isInteger(n) && n > 0 && n <= 30 && !/^(19|20)\d{2}/.test(o.controlNumber) && !/^\d{7,8}$/.test(o.controlNumber)) u = n
    }
    if (u == null && o.notes) {
      const m = o.notes.match(/\b(\d+(?:\.\d+)?)\s*(?:DIAS?|FALTAS?|RETARDOS?|INCIDENCIAS?|UDS?|UNIDADES?)\b/i)
      if (m) u = Number(m[1])
    }
    if (u != null && Number.isFinite(u) && u > 0) {
      units += u
      foundUnits = true
    }
  }
  if (!foundUnits) {
    units = matchingObs.length > 0 ? matchingObs.length : 1
  }

  // 2. Extraer fechas de incidencia
  let dateRange: DecodedSiapDateRange | null = null
  let date: DecodedSiapDate | null = null
  let fortnight: DecodedSiapFortnight | null = null
  const collectedDates: DecodedSiapDate[] = []

  for (const o of matchingObs) {
    const dr = decodeSiapDateRange(o.notes) || decodeSiapDateRange(o.controlNumber)
    if (dr) {
      if (!dateRange && !dr.isSingleDay) dateRange = dr
      if (!collectedDates.some((d) => d.isoDate === dr.startDate.isoDate)) collectedDates.push(dr.startDate)
      if (!dr.isSingleDay && !collectedDates.some((d) => d.isoDate === dr.endDate.isoDate)) collectedDates.push(dr.endDate)
    } else {
      const sd = decodeSiapDate(o.controlNumber) ?? decodeSiapDate(o.notes) ?? decodeSiapDate(o.duePeriod)
      if (sd && !collectedDates.some((d) => d.isoDate === sd.isoDate)) {
        collectedDates.push(sd)
      }
    }

    if (!fortnight) {
      fortnight =
        decodeQiFortnight(o.notes, periodDetails?.year ?? 2026) ||
        decodeQiFortnight(o.controlNumber, periodDetails?.year ?? 2026) ||
        decodeSiapFortnight(o.notes) ||
        decodeSiapFortnight(o.controlNumber) ||
        decodeSiapFortnight(o.duePeriod)
    }
  }

  // Fallback con la descripción de la línea
  if (collectedDates.length === 0 && !dateRange) {
    dateRange = decodeSiapDateRange(line?.description)
    date = dateRange?.startDate ?? decodeSiapDate(line?.description)
    if (date) collectedDates.push(date)
  }
  if (!date && collectedDates.length > 0) {
    date = collectedDates[0]
  }
  if (!fortnight && collectedDates.length === 0) {
    fortnight =
      decodeQiFortnight(line?.description, periodDetails?.year ?? 2026) ||
      decodeSiapFortnight(line?.description)
  }

  let dateFormatted = ""
  if (collectedDates.length === 1) {
    dateFormatted = collectedDates[0].formatted
  } else if (collectedDates.length > 1) {
    collectedDates.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    dateFormatted = collectedDates.map((d) => `${d.dayOfWeek} ${d.day} de ${SPANISH_MONTH_NAMES[d.month - 1]}`).join(", ") + ` de ${collectedDates[collectedDates.length - 1].year}`
  } else if (dateRange) {
    dateFormatted = dateRange.formatted
  } else if (fortnight) {
    dateFormatted = fortnight.label
  } else {
    dateFormatted = "la quincena evaluada"
  }

  let conceptName = "Falta Injustificada"
  if (normTarget === "171") conceptName = "Licencia sin sueldo de 1 a 3 días"
  else if (normTarget === "129") conceptName = "Licencia sin sueldo mayor a 3 días"
  else if (normTarget === "173") conceptName = "Pases de salida"
  else if (normTarget === "174") conceptName = "Retardos acumulados"
  else if (normTarget === "161") conceptName = "Suspensión temporal"
  else if (normTarget === "164") conceptName = "Suspensión sindical"
  else if (normTarget === "175") conceptName = "Beca sin sueldo"

  const unitLabel = normTarget === "174" ? `${units} ${units === 1 ? "retardo" : "retardos"}` : `${units} ${units === 1 ? "día" : "días"}`
  let incidenceText = ""
  if (collectedDates.length > 0 || dateRange) {
    if (normTarget === "174") incidenceText = `Retardo registrado el: ${dateFormatted} (${unitLabel})`
    else if (normTarget === "172") incidenceText = `Falta injustificada registrada el: ${dateFormatted} (${unitLabel})`
    else incidenceText = `${conceptName} registrada el: ${dateFormatted} (${unitLabel})`
  } else if (fortnight) {
    incidenceText = `${conceptName}: correspondiente a la ${fortnight.label} (${unitLabel})`
  } else {
    incidenceText = `${conceptName} amparada en este talón (${unitLabel})`
  }

  const impactOnIncentives =
    normTarget === "172" ||
    normTarget === "171" ||
    normTarget === "129" ||
    normTarget === "161" ||
    normTarget === "164" ||
    normTarget === "175"

  let summary = `Se aplicó un descuento de $${amount.toLocaleString("es-MX")} por concepto de ${conceptName} (${unitLabel}) correspondiente al ${dateFormatted}.`
  if (impactOnIncentives) {
    summary += ` Normativa (Art. 86 del RIT): Esta inasistencia anula automáticamente los estímulos de puntualidad y asistencia (032 y 033) del ciclo evaluado.`
  }

  if (periodDetails && date) {
    const incTime = new Date(date.year, date.month - 1, date.day).getTime()
    const payStart = new Date(periodDetails.year, periodDetails.month - 1, periodDetails.half === 1 ? 1 : 16).getTime()
    if (incTime < payStart) {
      summary += ` Descuento procesado por corte previo de nómina.`
    }
  }

  const actionAdvice = `Coteja la fecha señalada (${dateFormatted}) con tu reloj biométrico o listas de asistencia institucional. Si contabas con pase de salida oficial, comisión sindical, cambio de turno o justificante médico oficial, acude inmediatamente a tu representación sindical para iniciar la aclaración bilateral ante la Subdelegación/Jefatura de Personal para gestionar el reintegro salarial y recuperar los estímulos de puntualidad y asistencia (032 y 033).`

  return {
    code: normTarget,
    conceptName,
    amount,
    date: date ?? undefined,
    dateRange: dateRange ?? undefined,
    fortnight: fortnight ?? undefined,
    dateRaw: obs?.controlNumber || obs?.notes || obs?.duePeriod,
    units,
    summary,
    incidenceText,
    impactOnIncentives,
    statusLabel: "🚨 Descuento por inasistencia / incidencia",
    actionAdvice,
  }
}

/**
 * Interpreta fechas y liquidación de vacaciones:
 * Detecta conceptos 029 (Prima vacacional) y 048 (Ayuda actividades culturales y recreativas),
 * y busca en Observaciones rangos de fechas (ej. "DEL 20260701 AL 20260715") para reportar
 * la fecha de salida y la fecha de regreso.
 */
export function decodeVacacionesDetails(payslip: GuidePayslip): VacacionesInfo {
  const line029 = payslip.earnings.find((l) => l.code === "029")
  const line048 = payslip.earnings.find((l) => l.code === "048")
  const obs029 = payslip.observations.filter((o) => o.conceptCode === "029" || o.conceptCode === "048")

  const hasVacaciones = Boolean(line029 || line048 || payslip.observations.some((o) => (o.notes ?? "").toUpperCase().includes("VACACION")))

  if (!hasVacaciones) {
    return {
      hasVacaciones: false,
      summary: "No se registran periodos vacacionales en esta quincena.",
    }
  }

  const primaAmount = line029?.amount
  const ayudaAmount = line048?.amount
  const daysPaid = obs029.find((o) => o.units != null)?.units ?? undefined

  // Buscar rangos de fecha en notas de observaciones
  // "DEL 20260701 AL 20260715" o "DEL 01/07/2026 AL 15/07/2026" o "20260701 - 20260715"
  let departureDate: DecodedSiapDate | undefined
  let endDate: DecodedSiapDate | undefined
  let returnDate: DecodedSiapDate | undefined

  for (const obs of payslip.observations) {
    const text = `${obs.notes ?? ""} ${obs.controlNumber ?? ""}`.toUpperCase()
    const rangeMatch = text.match(/(?:DEL\s+)?(\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:AL|A|-)\s*(\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
    if (rangeMatch) {
      const d1 = decodeSiapDate(rangeMatch[1])
      const d2 = decodeSiapDate(rangeMatch[2])
      if (d1 && d2) {
        departureDate = d1
        endDate = d2
        // Fecha de regreso: siguiente día calendario al fin de las vacaciones
        returnDate = addDaysToDate(d2.year, d2.month, d2.day, 1)
        break
      }
    }
  }

  // Si no se encontró rango explícito pero hay una fecha en observaciones de 029/048 y días pagados
  if (!departureDate && daysPaid) {
    const obsDate = obs029.map((o) => decodeSiapDate(o.controlNumber || o.notes)).find((d): d is DecodedSiapDate => d !== null)
    if (obsDate) {
      departureDate = obsDate
      endDate = addDaysToDate(obsDate.year, obsDate.month, obsDate.day, Math.max(1, daysPaid - 1))
      returnDate = addDaysToDate(endDate.year, endDate.month, endDate.day, 1)
    }
  }

  let summary = "¡Periodo vacacional en tu tarjetón! "
  if (departureDate && returnDate) {
    summary += `Tu fecha de salida es el ${departureDate.formatted} y tu fecha de regreso a labores es el ${returnDate.formatted}`
    if (daysPaid) summary += ` (${daysPaid} días de descanso disfrutados).`
    else summary += "."
  } else if (departureDate) {
    summary += `Fecha de inicio registrada: ${departureDate.formatted}.`
  } else {
    summary += `Se liquidaron tus prestaciones vacacionales${daysPaid ? ` por ${daysPaid} días` : ""}.`
  }

  if (primaAmount) {
    summary += ` Recibiste $${primaAmount.toLocaleString("es-MX")} por prima vacacional (Concepto 029).`
  }
  if (ayudaAmount) {
    summary += ` Recibiste $${ayudaAmount.toLocaleString("es-MX")} por actividades culturales y recreativas (Concepto 048).`
  }

  return {
    hasVacaciones: true,
    primaAmount,
    ayudaAmount,
    daysPaid,
    departureDate,
    endDate,
    returnDate,
    summary,
  }
}

/**
 * Detecta y desglosa pagos retroactivos presentes en el tarjetón.
 */
export function decodeRetroactivoDetails(payslip: GuidePayslip): RetroactivoInfo[] {
  const results: RetroactivoInfo[] = []

  // 1. Líneas con "RETRO" en la descripción
  for (const line of payslip.earnings) {
    const desc = line.description.toUpperCase()
    if (desc.includes("RETRO") || desc.includes("DIFERENCIA")) {
      const obs = payslip.observations.find((o) => o.conceptCode === line.code)
      let targetPeriod: string | undefined
      if (obs?.duePeriod) {
        const fn = decodeSiapFortnight(obs.duePeriod)
        targetPeriod = fn ? fn.label : obs.duePeriod
      }
      results.push({
        code: line.code || "000",
        description: line.description,
        amount: line.amount,
        targetPeriod,
        notes: obs?.notes,
        summary: `Pago retroactivo de ${line.description} (${line.code}) por $${line.amount.toLocaleString("es-MX")}${targetPeriod ? `, correspondiente a ${targetPeriod}` : ""}.`,
      })
    }
  }

  // 2. Observaciones con leyendas "RETROACTIVO" para conceptos no marcados en la línea
  for (const obs of payslip.observations) {
    const notes = (obs.notes ?? "").toUpperCase()
    if (notes.includes("RETRO") && !results.some((r) => r.code === obs.conceptCode)) {
      const line = payslip.earnings.find((l) => l.code === obs.conceptCode)
      let targetPeriod: string | undefined
      if (obs.duePeriod) {
        const fn = decodeSiapFortnight(obs.duePeriod)
        targetPeriod = fn ? fn.label : obs.duePeriod
      }
      results.push({
        code: obs.conceptCode,
        description: line?.description || `Concepto ${obs.conceptCode}`,
        amount: obs.amount ?? line?.amount ?? 0,
        targetPeriod,
        notes: obs.notes,
        summary: `Ajuste retroactivo en Concepto ${obs.conceptCode}${targetPeriod ? ` de ${targetPeriod}` : ""}${obs.amount ? ` por $${obs.amount.toLocaleString("es-MX")}` : ""}.`,
      })
    }
  }

  return results
}
