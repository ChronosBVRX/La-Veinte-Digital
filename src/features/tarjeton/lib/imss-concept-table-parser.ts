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

function isTableHeader(line: ReconstructedLine): boolean {
  return line.norm.includes("CONCEPTO DESCRIPCION IMPORTE")
}

function parseLinesBetweenTotals(
  lines: ReconstructedLine[],
  startAnchor: string,
  totalAnchor: string,
  kind: "earning" | "deduction",
  warnings: string[],
  lineIndexOffset = 0,
): TarjetonConceptLine[] {
  const result: TarjetonConceptLine[] = []
  const start = lines.findIndex((line) => line.norm.includes(startAnchor))
  if (start < 0) return result
  const relativeEnd = lines.slice(start + 1).findIndex((line) => line.norm.includes(totalAnchor))
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]
    if (line.norm.includes("TOTAL")) continue
    if (line.norm.includes("PERCEPCIONES") || line.norm.includes("DEDUCCIONES") || line.norm.includes("OBSERVACIONES")) continue
    if (isTableHeader(line)) continue

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
      lineIndex: lineIndexOffset + i,
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

export function parseImssConceptTables(
  earningsLines: ReconstructedLine[],
  deductionLines: ReconstructedLine[],
): ConceptTableResult {
  const warnings: string[] = []

  const earnings = parseLinesBetweenTotals(earningsLines, "PERCEPCIONES", "TOTAL PERCEPCIONES", "earning", warnings)
  const deductions = parseLinesBetweenTotals(
    deductionLines,
    "DEDUCCIONES",
    "TOTAL DEDUCCIONES",
    "deduction",
    warnings,
    earningsLines.length,
  )

  const totalEarnings = extractTotal(earningsLines, "TOTAL PERCEPCIONES")
  const totalDeductions = extractTotal(deductionLines, "TOTAL DEDUCCIONES")
  const netPay = extractTotal(deductionLines, "LIQUIDO")

  return { earnings, deductions, totalEarnings, totalDeductions, netPay, warnings }
}
