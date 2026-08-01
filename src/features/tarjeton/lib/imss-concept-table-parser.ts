/**
 * Parser de las tablas de percepciones y deducciones del tarjetón IMSS.
 *
 * Cada fila tiene: código (3 dígitos), descripción e importe. Se conservan
 * códigos repetidos (arreglos con lineIndex) y descripciones multilínea.
 * Los totales ("TOTAL PERCEPCIONES", "TOTAL DEDUCCIONES", "LIQUIDO") se
 * buscan en todo el documento porque pueden ubicarse en filas contiguas.
 */
import type { TarjetonConceptLine } from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { findLineSpan } from "./line-reconstruction"
import { parseImssMoney } from "./money-parser"
import { clampConfidence } from "./confidence"

const ROW_PATTERN = /^(\d{3})\s+(.+?)\s+(-?[\d\s,]+\.\d{2})\s*$/
const AMOUNT_ONLY_PATTERN = /^[-+]?[\d\s,]+\.\d{2}$/

export interface ConceptTableResult {
  earnings: TarjetonConceptLine[]
  deductions: TarjetonConceptLine[]
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
  warnings: string[]
}

function parseRow(line: ReconstructedLine): { code: string; description: string; amount: number } | null {
  const match = line.text.trim().match(ROW_PATTERN)
  if (!match) return null
  const amount = parseImssMoney(match[3])
  if (amount === undefined) return null
  return { code: match[1], description: match[2].trim(), amount }
}

function parseLinesInRange(
  lines: ReconstructedLine[],
  range: { start: number; end: number } | null,
  kind: "earning" | "deduction",
  warnings: string[],
): TarjetonConceptLine[] {
  const result: TarjetonConceptLine[] = []
  if (!range) return result

  for (let i = range.start + 1; i < range.end; i++) {
    const line = lines[i]
    if (line.norm.includes("TOTAL")) continue
    if (line.norm.includes("PERCEPCIONES") || line.norm.includes("DEDUCCIONES") || line.norm.includes("OBSERVACIONES")) continue

    const row = parseRow(line)
    if (!row) {
      // Posible descripción multilínea: si la fila anterior quedó sin importe,
      // se agrega el texto actual a la descripción pendiente.
      const last = result[result.length - 1]
      const pendingAmount = AMOUNT_ONLY_PATTERN.test(line.text.trim())
      if (last && pendingAmount) {
        const amount = parseImssMoney(line.text.trim())
        if (amount !== undefined) {
          result[result.length - 1] = { ...last, amount }
        }
        continue
      }
      if (last && !AMOUNT_ONLY_PATTERN.test(line.text.trim())) {
        const merged = `${last.description} ${line.text.trim()}`.trim()
        result[result.length - 1] = { ...last, description: merged, confidence: clampConfidence(last.confidence - 0.08) }
        continue
      }
      warnings.push(`Fila de ${kind} sin interpretar: "${line.text}"`)
      continue
    }

    // Continuación del código anterior si el código se repite sin importe.
    const last = result[result.length - 1]
    if (last && last.code === row.code && !last.description.endsWith(row.description)) {
      result[result.length - 1] = { ...last, description: `${last.description} ${row.description}`.trim() }
      continue
    }

    result.push({
      lineIndex: i,
      code: row.code,
      description: row.description,
      amount: row.amount,
      kind,
      confidence: clampConfidence(line.method === "ocr" ? line.confidence : 0.98),
      confirmedByUser: false,
    })
  }

  return result
}

function extractTotal(lines: ReconstructedLine[], labelNorm: string): number | undefined {
  for (const line of lines) {
    if (!line.norm.includes(labelNorm)) continue
    const match = line.text.match(/(-?[\d\s,]+\.\d{2})\s*$/)
    if (!match) continue
    const amount = parseImssMoney(match[1])
    if (amount !== undefined) return amount
  }
  return undefined
}

export function parseImssConceptTables(lines: ReconstructedLine[]): ConceptTableResult {
  const warnings: string[] = []

  const earningsRange = findLineSpan(lines, "PERCEPCIONES", "DEDUCCIONES")
  const deductionsRange = findLineSpan(lines, "DEDUCCIONES", "OBSERVACIONES")

  const earnings = parseLinesInRange(lines, earningsRange, "earning", warnings)
  const deductions = parseLinesInRange(lines, deductionsRange, "deduction", warnings)

  const totalEarnings = extractTotal(lines, "TOTAL PERCEPCIONES")
  const totalDeductions = extractTotal(lines, "TOTAL DEDUCCIONES")
  const netPay = extractTotal(lines, "LIQUIDO")

  return { earnings, deductions, totalEarnings, totalDeductions, netPay, warnings }
}
