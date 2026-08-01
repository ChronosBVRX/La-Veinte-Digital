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

/** "01/02/2026" | "01-02-2026" | "01-ENE-2026" → "2026-02-01". */
export function parseImssDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const input = raw.trim()
  if (!input) return undefined

  const numeric = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (numeric) {
    const [day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const named = input.match(/^(\d{1,2})[\/\- ](ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[\/\- ]?(\d{4})$/i)
  if (named) {
    const day = Number(named[1])
    const month = IMSS_MONTHS[named[2].toUpperCase()]
    const year = Number(named[3])
    if (!month || day < 1 || day > 31) return undefined
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
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
