/**
 * Parser de fechas y periodos del tarjetón IMSS.
 *
 * El periodo aparece como "1A-ENE-2026", "2A-JUL-2026", "1A-DIC-2025".
 * Las fechas de vencimiento como "2026014" se conservan como texto
 * original (no se interpretan códigos sin formato documentado).
 */

export const IMSS_MONTHS: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
}

export const IMSS_MONTH_NAMES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
}

export interface ParsedImssPeriod {
  year: number
  month: number
  half: 1 | 2
  /** Periodo normalizado: "1A-ENE-2026". */
  normalized: string
}

/** "1A-ENE-2026" | "1A ENE 2026" | "2A-JUL-2026" | "PRIMERA QUINCENA ENE-2026" */
export function parseImssPeriod(raw: string | null | undefined): ParsedImssPeriod | null {
  if (!raw) return null
  const input = raw.trim().toUpperCase()
  if (!input) return null

  const halfMatch = input.match(/(\d)\s*A\b/)
  if (!halfMatch) return null
  const half = halfMatch[1] === "1" ? (1 as const) : (2 as const)

  const monthMatch = input.match(/\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\b/)
  if (!monthMatch) return null
  const month = IMSS_MONTHS[monthMatch[1]]

  const yearMatch = input.match(/\b(20\d{2})\b/)
  if (!yearMatch) return null
  const year = Number(yearMatch[1])

  return {
    year,
    month,
    half,
    normalized: `${half}A-${monthMatch[1]}-${year}`,
  }
}

/**
 * Validador estricto de fecha civil mexicana (sin conversión UTC/Date que altere días ni normalice inválidas).
 * Valida años bisiestos, rango laboral razonable (1950..2100) y días reales del mes.
 */
export function isValidMexicanCivilDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false
  }
  if (year < 1950 || year > 2100) {
    return false
  }
  if (month < 1 || month > 12) {
    return false
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const maxDays = daysInMonth[month - 1]

  return day >= 1 && day <= maxDays
}

/** Formatea componentes validados a formato canónico ISO YYYY-MM-DD. */
export function formatCivilIsoDate(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, "0")
  const mm = String(month).padStart(2, "0")
  const yyyy = String(year).padStart(4, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Formatea una fecha canónica YYYY-MM-DD a formato civil mexicano DD/MM/YYYY. */
export function formatMexicanDate(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== "string") return ""
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return isoDate
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

/** "01/02/2026" | "01-02-2026" | "01-ENE-2026" → "2026-02-01". */
export function parseImssDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const input = raw.trim()
  if (!input) return undefined

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-").map(Number)
    if (isValidMexicanCivilDate(day, month, year)) return formatCivilIsoDate(day, month, year)
    return undefined
  }

  const numeric = input.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (numeric) {
    const [day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    if (isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  const named = input.match(/^(\d{1,2})[\/\- ](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[\/\- ]?(\d{4})$/i)
  if (named) {
    const day = Number(named[1])
    const month = IMSS_MONTHS[named[2].toUpperCase()]
    const year = Number(named[3])
    if (month && isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  return undefined
}

/**
 * Parser exclusivo para la fecha del campo "POR VENCER".
 *
 * Acepta formatos confirmados:
 * - 8 dígitos consecutivos DDMMYYYY (ej. 14102026 → 2026-10-14)
 * - Con separadores: 14/10/2026, 14-10-2026, 14.10.2026, 14 10 2026, 14 / 10 / 2026
 * - Separación accidental por OCR: 1 4 1 0 2 0 2 6
 * - Mes nombrado: 14-OCT-2026
 * - Canónico ISO existente: 2026-10-14
 *
 * Aplica validación civil estricta con años bisiestos. Nunca interpreta como MMDDYYYY.
 */
export function parsePorVencerDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const input = raw.trim()
  if (!input) return undefined

  // 1. Ya en formato canónico ISO YYYY-MM-DD
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  // 2. Variante compacta de 8 dígitos DDMMYYYY o con espacios entre dígitos por OCR
  const digitsOnly = input.replace(/\s+/g, "")
  if (/^\d{8}$/.test(digitsOnly)) {
    const day = Number(digitsOnly.slice(0, 2))
    const month = Number(digitsOnly.slice(2, 4))
    const year = Number(digitsOnly.slice(4, 8))
    if (isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  // 3. Formato con separadores (/, -, ., espacios): 14/10/2026, 14-10-2026, 14.10.2026, 14 10 2026, 14 / 10 / 2026
  const sepMatch = input.match(/^(\d{1,2})\s*[\/\-.\s]\s*(\d{1,2})\s*[\/\-.\s]\s*(\d{4})$/)
  if (sepMatch) {
    const day = Number(sepMatch[1])
    const month = Number(sepMatch[2])
    const year = Number(sepMatch[3])
    if (isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  // 4. Formato con mes nombrado: 14-OCT-2026, 14/OCT/2026, 14 OCT 2026
  const namedMatch = input.match(/^(\d{1,2})\s*[\/\-.\s]\s*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\w*\s*[\/\-.\s]?\s*(\d{4})$/i)
  if (namedMatch) {
    const day = Number(namedMatch[1])
    const month = IMSS_MONTHS[namedMatch[2].toUpperCase().slice(0, 3)]
    const year = Number(namedMatch[3])
    if (month && isValidMexicanCivilDate(day, month, year)) {
      return formatCivilIsoDate(day, month, year)
    }
    return undefined
  }

  return undefined
}

/**
 * Fin del periodo (fecha de corte del tarjetón) a partir del periodo.
 * Se usa como referencia para reconstruir la fecha efectiva de antigüedad.
 * La 1ra quincena corta el día 15; la 2da el último día del mes.
 */
export function imssPeriodEndDate(period: ParsedImssPeriod): string {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
  const day = period.half === 1 ? 15 : lastDay
  return `${period.year}-${String(period.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
