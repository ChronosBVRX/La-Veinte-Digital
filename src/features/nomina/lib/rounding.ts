export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "").replace(/\s/g, "")
  if (!cleaned) return null
  if (/[^\d.-]/.test(cleaned.replace(".", ""))) return null
  const num = Number(cleaned)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

/**
 * Truncamiento a centavos (NO redondeo).
 *
 * La nómina del IMSS trunca los conceptos derivados por porcentaje:
 *   7172.41 × 24% = 1721.3784 → $1,721.37 (Math.round daría $1,721.38)
 *   7172.41 × 16% = 1147.5856 → $1,147.58 (Math.round daría $1,147.59)
 * Evidencia: tarjetón real 2A-AGO-2026, TÉCNICO RADIÓLOGO 80.
 */
export function truncateCurrency(value: number): number {
  return Math.floor((value + Number.EPSILON) * 100) / 100
}
