/**
 * Parser tolerante de antigüedad almacenada como texto libre.
 *
 * Soporta formatos como:
 *   "10", "10 años", "10 años 4 meses", "10 años 4 meses 12 días",
 *   "10-04-12", "10/4/12", "A:10 M:4 D:12", "10 anios 4 meses"
 *
 * Devuelve null cuando el texto no es interpretable (para no inventar datos).
 */

export interface ParsedSeniority {
  years: number
  months: number
  days: number
}

const WORD_YEAR = /^(?:años?|anos?|anios?|annos?)$/i
const WORD_MONTH = /^(?:meses|mes)$/i
const WORD_DAY = /^(?:días?|dias?)$/i

const MAX_YEARS = 60
const MAX_MONTHS = 11
const MAX_DAYS = 31

function toNumber(raw: string): number | null {
  const n = Number(raw.trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

function isValidRange(parts: ParsedSeniority): boolean {
  return (
    parts.years <= MAX_YEARS &&
    parts.months <= MAX_MONTHS &&
    parts.days <= MAX_DAYS
  )
}

function parseLabeledColon(input: string): ParsedSeniority | null {
  const parts: ParsedSeniority = { years: 0, months: 0, days: 0 }
  let found = false

  const yearMatch = input.match(/A\s*[:=]\s*(\d+)/i)
  const monthMatch = input.match(/M\s*[:=]\s*(\d+)/i)
  const dayMatch = input.match(/D\s*[:=]\s*(\d+)/i)

  if (yearMatch) { parts.years = Number(yearMatch[1]); found = true }
  if (monthMatch) { parts.months = Number(monthMatch[1]); found = true }
  if (dayMatch) { parts.days = Number(dayMatch[1]); found = true }

  if (!found) return null
  return isValidRange(parts) ? parts : null
}

function parseSeparatedParts(input: string): ParsedSeniority | null {
  const sep = input.split(/[-/]+/)
  if (sep.length !== 3) return null
  const [a, b, c] = sep.map(toNumber)
  if (a === null || b === null || c === null) return null
  const parts = { years: a, months: b, days: c }
  return isValidRange(parts) ? parts : null
}

function parseLabeledParts(input: string): ParsedSeniority | null {
  const tokens = input.split(/[\s,;]+/).filter(Boolean)
  if (tokens.length === 0) return null

  const parts: ParsedSeniority = { years: 0, months: 0, days: 0 }
  const used = new Set<number>()
  let anyLabel = false

  for (let i = 0; i < tokens.length; i++) {
    const n = toNumber(tokens[i])
    if (n === null) continue
    const next = tokens[i + 1] ?? ""

    if (WORD_YEAR.test(next)) {
      parts.years = n
      used.add(i); used.add(i + 1)
      anyLabel = true
    } else if (WORD_MONTH.test(next)) {
      parts.months = n
      used.add(i); used.add(i + 1)
      anyLabel = true
    } else if (WORD_DAY.test(next)) {
      parts.days = n
      used.add(i); used.add(i + 1)
      anyLabel = true
    }
  }

  const remainingNumbers = tokens.filter((t, i) => !used.has(i) && toNumber(t) !== null)
  const remainingLabels = tokens.filter((t, i) => !used.has(i) && /[a-z]/i.test(t))

  if (anyLabel) {
    if (remainingNumbers.length > 0 || remainingLabels.length > 0) return null
  } else {
    if (remainingNumbers.length === 1 && remainingLabels.length === 0) {
      parts.years = toNumber(remainingNumbers[0])!
    } else {
      return null
    }
  }

  const hasValue = parts.years > 0 || parts.months > 0 || parts.days > 0
  if (!hasValue) return null
  return isValidRange(parts) ? parts : null
}

export function parseSeniorityText(value: string | null | undefined): ParsedSeniority | null {
  if (!value) return null
  const input = value.trim().replace(/\s+/g, " ")
  if (!input) return null

  const colon = parseLabeledColon(input)
  if (colon) return colon

  const separated = parseSeparatedParts(input)
  if (separated) return separated

  return parseLabeledParts(input)
}
