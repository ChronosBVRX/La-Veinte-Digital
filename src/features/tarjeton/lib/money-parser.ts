/**
 * Parser estricto de importes monetarios del tarjetón IMSS.
 *
 * El formato del tarjetón usa separador de miles con coma y decimal con
 * punto: "3,937.64", "-2,390.73". Se aceptan espacios como separador de
 * miles ("1 000.50"). Nunca devuelve NaN y un campo vacío es undefined.
 */

const MONEY_PATTERN = /^([+-]?)\s*\$?\s*[\d\s,]*\d(?:\.\d{1,2})?$/

export function parseImssMoney(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const input = raw.trim()
  if (!input) return undefined

  if (!MONEY_PATTERN.test(input)) return undefined
  if (/[a-zA-Z]/.test(input)) return undefined

  // Cadenas ambiguas: dos puntos decimales o punto+coma (formato europeo).
  const dotCount = (input.match(/\./g) ?? []).length
  const commaCount = (input.match(/,/g) ?? []).length
  if (dotCount > 1) return undefined
  if (commaCount > 0 && dotCount === 0) return undefined

  const sign = input.trim().startsWith("-") ? -1 : 1
  const cleaned = input
    .replace(/^[+-]\s*/, "")
    .replace(/[\$\s,]/g, "")

  if (!cleaned) return undefined
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return undefined

  return sign * n
}

/** Redondeo a 2 decimales con tolerancia de punto flotante. */
export function roundImssMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Suma segura de importes (nunca NaN). */
export function sumImssMoney(values: Array<number | undefined>): number {
  let total = 0
  for (const v of values) {
    if (v !== undefined && Number.isFinite(v)) total += v
  }
  return roundImssMoney(total)
}
