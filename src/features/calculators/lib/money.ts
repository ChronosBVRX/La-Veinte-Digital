export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
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
