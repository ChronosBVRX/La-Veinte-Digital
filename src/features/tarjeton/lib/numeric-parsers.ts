/**
 * Parsers numéricos específicos por tipo de campo del tarjetón IMSS.
 *
 * Separar los tipos evita que un importe monetario se interprete como
 * conteo de días, o que un valor decimal inválido pase como entero.
 */

export type NumericFieldKind =
  | "integer_count"
  | "decimal_count"
  | "money"
  | "percentage"
  | "days"
  | "hours"

function cleanNumericInput(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return ""
  return raw.trim().replace(/\s+/g, " ")
}

/**
 * Conteos enteros: retardos, faltas, pases de salida, etc.
 * No acepta decimales, signos ni separadores de miles.
 */
export function parseIntegerCount(raw: string | null | undefined): number | undefined {
  const input = cleanNumericInput(raw)
  if (!input) return undefined
  if (!/^\d{1,4}$/.test(input)) return undefined
  const value = Number(input)
  return Number.isSafeInteger(value) ? value : undefined
}

/**
 * Conteos que pueden incluir medias unidades (p. ej. medios días).
 */
export function parseDecimalCount(raw: string | null | undefined): number | undefined {
  const input = cleanNumericInput(raw)
  if (!input) return undefined
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(input)) return undefined
  const value = Number(input)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Porcentaje: 0..100 con hasta 2 decimales.
 */
export function parsePercentage(raw: string | null | undefined): number | undefined {
  const input = cleanNumericInput(raw)
  if (!input) return undefined
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(input)) return undefined
  const value = Number(input)
  if (!Number.isFinite(value) || value < 0 || value > 100) return undefined
  return value
}

/**
 * Días: enteros o medios días, con límite razonable.
 */
export function parseDays(raw: string | null | undefined): number | undefined {
  const input = cleanNumericInput(raw)
  if (!input) return undefined
  if (!/^\d{1,3}(?:\.5)?$/.test(input)) return undefined
  const value = Number(input)
  if (!Number.isFinite(value) || value < 0 || value > 365) return undefined
  return value
}

/**
 * Horas de jornada: 6, 6.5, 8, 12, etc.
 */
export function parseHours(raw: string | null | undefined): number | undefined {
  const input = cleanNumericInput(raw)
  if (!input) return undefined
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(input)) return undefined
  const value = Number(input)
  if (!Number.isFinite(value) || value < 1 || value > 24) return undefined
  return value
}
