/**
 * Parser de antigüedad del tarjetón IMSS.
 *
 * El formato real usa quincenas: "14 años 3 qnas 1 días".
 * Las quincenas NO se convierten a meses: se conservan como fortnights
 * (1 qna = 15 días) para reconstruir la fecha efectiva.
 *
 * No modifica `parseSeniorityText` (features/nomina): es una función
 * separada para el tarjetón.
 */
import type { TarjetonSeniority } from "@/shared/contracts/tarjeton-import"

export interface ParsedImssSeniority {
  years: number
  fortnights: number
  days: number
}

const WORD_YEAR = /^(?:años?|anos?|anios?|annos?)$/i
const WORD_FORTNIGHT = /^(?:qnas?|quincenas?)$/i
const WORD_DAY = /^(?:días?|dias?)$/i

const MAX_YEARS = 60
const MAX_FORTNIGHTS = 60
const MAX_DAYS = 31

function toNumber(raw: string): number | null {
  const n = Number(raw.trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

function isValid(parts: ParsedImssSeniority): boolean {
  return (
    parts.years <= MAX_YEARS &&
    parts.fortnights <= MAX_FORTNIGHTS &&
    parts.days <= MAX_DAYS
  )
}

/**
 * "14 años 3 qnas 1 días" → { years: 14, fortnights: 3, days: 1 }
 * "10 años 2 quincenas"   → { years: 10, fortnights: 2, days: 0 }
 * "5 años 4 qnas 10 días" → { years: 5, fortnights: 4, days: 10 }
 * Devuelve null para texto inválido o ambiguo.
 */
export function parseImssPayslipSeniority(value: string | null | undefined): ParsedImssSeniority | null {
  if (!value) return null
  const input = value.trim().replace(/\s+/g, " ")
  if (!input) return null

  const tokens = input.split(/[\s,;]+/).filter(Boolean)
  const parts: ParsedImssSeniority = { years: 0, fortnights: 0, days: 0 }
  let anyLabel = false

  for (let i = 0; i < tokens.length; i++) {
    const n = toNumber(tokens[i])
    if (n === null) continue
    const next = tokens[i + 1] ?? ""

    if (WORD_YEAR.test(next)) {
      parts.years = n
      anyLabel = true
      i++
    } else if (WORD_FORTNIGHT.test(next)) {
      parts.fortnights = n
      anyLabel = true
      i++
    } else if (WORD_DAY.test(next)) {
      parts.days = n
      anyLabel = true
      i++
    }
  }

  if (!anyLabel) return null
  const hasValue = parts.years > 0 || parts.fortnights > 0 || parts.days > 0
  if (!hasValue) return null
  if (!isValid(parts)) return null
  return parts
}

/**
 * Reconstruye la fecha efectiva de antigüedad:
 * fin de periodo − años calendario − (quincenas × 15 días) − días.
 * El resultado se recorta al último día del mes si el cálculo cae en una
 * fecha inexistente (p. ej. 31 de febrero).
 */
export function reconstructEffectiveDateFromSeniority(
  seniority: ParsedImssSeniority,
  periodEndDate: string,
): string {
  const [y, m, d] = periodEndDate.split("-").map(Number)

  const date = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(date.getTime())) return periodEndDate

  // Resta años calendario primero (setUTCFullYear recorta días inexistentes).
  date.setUTCFullYear(date.getUTCFullYear() - seniority.years)

  const totalDays = seniority.fortnights * 15 + seniority.days
  date.setUTCDate(date.getUTCDate() - totalDays)

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

export function buildTarjetonSeniority(
  raw: string,
  parsed: ParsedImssSeniority,
  periodEndDate: string,
): TarjetonSeniority {
  return {
    raw,
    years: parsed.years,
    fortnights: parsed.fortnights,
    days: parsed.days,
    referenceDate: periodEndDate,
    reconstructedEffectiveDate: reconstructEffectiveDateFromSeniority(parsed, periodEndDate),
  }
}
