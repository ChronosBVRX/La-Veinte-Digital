/**
 * Modelo canónico universal para conceptos de nómina / tarjetón IMSS.
 * Compatible con extracciones PDF/OCR, SQLite, Supabase y simulador/guía.
 */
export interface PayslipConcept {
  code: string          // Código normalizado (2 a 4 dígitos, ej. "02", "002", "107")
  description: string   // Descripción limpia del concepto (ej. "SUELDO", "AYUDA DE RENTA")
  amount: number        // Importe numérico normalizado en pesos
  kind: "earning" | "deduction" // Percepción o deducción
  confidence?: number   // Confianza de extracción OCR/PDF (0.0 a 1.0)
  confirmedByUser?: boolean
  lineIndex?: number
}

/**
 * Normaliza cualquier fila o representación cruda a un objeto `PayslipConcept`.
 * Tolera:
 * - code vs concept_code vs conceptCode vs clave
 * - amount vs importe vs monto vs saldo (number o string con $, comas, etc.)
 * - kind ("earning" | "deduction" | "percepcion" | "deduccion")
 * - códigos de 2, 3 o 4 dígitos (con o sin ceros a la izquierda)
 */
export function normalizePayslipConcept(
  raw: unknown,
  fallbackKind: "earning" | "deduction" = "earning"
): PayslipConcept | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>

  // 1. Extraer y normalizar código
  const rawCode = String(r.code ?? r.concept_code ?? r.conceptCode ?? r.clave ?? r.codigo ?? "").trim()
  if (!rawCode) return null

  // Aceptar 2 a 4 dígitos numéricos
  const matchCode = rawCode.match(/\b\d{2,4}\b/)
  if (!matchCode) return null
  const code = matchCode[0]

  // 2. Extraer y normalizar importe (amount / importe)
  let amount = 0
  const rawAmount = r.amount ?? r.importe ?? r.monto ?? r.saldo
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount)) {
    amount = rawAmount
  } else if (typeof rawAmount === "string") {
    // Limpiar $, espacios, comas
    const cleaned = rawAmount.replace(/[$ ]/g, "").replace(/,/g, "")
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && isFinite(parsed)) {
      amount = parsed
    } else {
      return null
    }
  } else if (r.amount === undefined && r.importe === undefined) {
    amount = 0
  }

  // 3. Extraer y normalizar descripción
  const description = String(r.description ?? r.descripcion ?? r.concepto ?? "").trim()

  // 4. Extraer kind
  const rawKind = String(r.kind ?? r.tipo ?? fallbackKind).toLowerCase()
  const kind: "earning" | "deduction" =
    rawKind.includes("deduc") ? "deduction" : "earning"

  const confidence = typeof r.confidence === "number" ? r.confidence : undefined
  const confirmedByUser = typeof r.confirmedByUser === "boolean" ? r.confirmedByUser : undefined
  const lineIndex = typeof r.lineIndex === "number" ? r.lineIndex : undefined

  return {
    code,
    description,
    amount,
    kind,
    confidence,
    confirmedByUser,
    lineIndex,
  }
}
