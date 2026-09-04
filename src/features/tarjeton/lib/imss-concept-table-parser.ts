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
import { baseFieldConfidence, clampConfidence, multilineAdjustment } from "./confidence"
import { isConceptCode, normalizeText } from "./positioned-text"

const ROW_PATTERN = /^(\d{2,4})\s+(.+?)\s+(-?\$?[\d\s,]+\.\d{2})\s*$/
const AMOUNT_ONLY_PATTERN = /^[-+]?\$?\d[\d\s,]*(?:\.\d{1,2})?$/

export interface ConceptTableResult {
  earnings: TarjetonConceptLine[]
  deductions: TarjetonConceptLine[]
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
  warnings: string[]
}

function parseRow(line: ReconstructedLine): { code: string; description: string; amount: number } | null {
  const codeIndex = line.items.findIndex((item) => isConceptCode(item.text))
  if (codeIndex >= 0) {
    let amountIndex = -1
    for (let index = line.items.length - 1; index > codeIndex; index--) {
      const item = line.items[index]
      if (AMOUNT_ONLY_PATTERN.test(item.text.trim()) && parseImssMoney(item.text) !== undefined) {
        amountIndex = index
        break
      }
    }
    if (amountIndex > codeIndex) {
      const description = line.items
        .slice(codeIndex + 1, amountIndex)
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(" ")
      const amount = parseImssMoney(line.items[amountIndex].text)
      if (description && amount !== undefined) {
        return { code: line.items[codeIndex].text.trim(), description, amount }
      }
    }
  }

  const match = line.text.trim().match(ROW_PATTERN)
  if (!match) return null
  const amount = parseImssMoney(match[3])
  if (amount === undefined) return null
  return { code: match[1], description: match[2].trim(), amount }
}

function isTableHeader(line: ReconstructedLine): boolean {
  const norm = normalizeText(line.text)
  return (
    norm.includes("CONCEPTO DESCRIPCION IMPORTE") ||
    norm === "CONCEPTO" ||
    norm === "DESCRIPCION" ||
    norm === "IMPORTE"
  )
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

  const shortAnchor = startAnchor.slice(0, 5) // "PERCE" o "DEDUC"
  const start = lines.findIndex(
    (line) => !line.norm.includes("TOTAL") && (line.norm.includes(startAnchor) || line.norm.includes(shortAnchor))
  )
  if (start < 0) return result

  const shortTotalAnchor = totalAnchor.replace("TOTAL ", "").slice(0, 5)
  const relativeEnd = lines.slice(start + 1).findIndex((line) =>
    line.norm.includes(totalAnchor) ||
    (line.norm.includes("TOTAL") && line.norm.includes(shortTotalAnchor))
  )
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]
    if (line.norm.includes("TOTAL")) continue
    if (line.norm.includes("PERCEPCIONES") || line.norm.includes("DEDUCCIONES") || line.norm.includes("OBSERVACIONES")) continue
    if (isTableHeader(line)) continue

    const row = parseRow(line)
    if (!row) {
      const last = result[result.length - 1]
      const hasCode = line.items.some((item) => isConceptCode(item.text))
      const hasAmount = line.items.some((item) => AMOUNT_ONLY_PATTERN.test(item.text.trim()))
      if (last && !hasCode && !hasAmount && (i === 0 || line.y - lines[i - 1].y <= 24)) {
        const merged = `${last.description} ${line.text.trim()}`.trim()
        result[result.length - 1] = {
          ...last,
          description: merged,
          confidence: clampConfidence(multilineAdjustment(last.confidence, true)),
        }
        continue
      }
      warnings.push(kind === "earning" ? "Fila de percepción sin interpretar." : "Fila de deducción sin interpretar.")
      continue
    }

    result.push({
      lineIndex: lineIndexOffset + result.length,
      code: row.code,
      description: row.description,
      amount: row.amount,
      kind,
      confidence: clampConfidence(baseFieldConfidence(line.method, line.confidence)),
      confirmedByUser: false,
    })
  }

  return result
}

function extractTotal(lines: ReconstructedLine[], labelNorm: string): number | undefined {
  const shortLabel = labelNorm.replace("TOTAL ", "").slice(0, 5)
  for (const line of lines) {
    const matchesLabel =
      line.norm.includes(labelNorm) ||
      (line.norm.includes("TOTAL") && line.norm.includes(shortLabel)) ||
      (labelNorm === "LIQUIDO" && (line.norm.includes("LIQUIDO") || line.norm.includes("NETO")))
    if (!matchesLabel) continue
    const match = line.text.match(/(-?\$?[\d\s,]+\.\d{2})\s*$/)
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
    earnings.length,
  )

  const totalEarnings = extractTotal(earningsLines, "TOTAL PERCEPCIONES")
  const totalDeductions = extractTotal(deductionLines, "TOTAL DEDUCCIONES")
  const netPay = extractTotal(deductionLines, "LIQUIDO")

  return { earnings, deductions, totalEarnings, totalDeductions, netPay, warnings }
}
