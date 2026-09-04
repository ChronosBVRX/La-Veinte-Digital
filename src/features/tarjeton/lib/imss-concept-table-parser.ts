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

const ROW_PATTERN = /^([A-Za-z0-9]{2,4})\s+(.+?)\s+([-+]?\$?\s*[\d\s,]+(?:\.\d{1,2})?-?)\s*$/
const AMOUNT_ONLY_PATTERN = /^[-+]?\$?\s*\d[\d\s,]*(?:\.\d{1,2})?-?$/

export interface ConceptTableResult {
  earnings: TarjetonConceptLine[]
  deductions: TarjetonConceptLine[]
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
  warnings: string[]
}

function parseRow(line: ReconstructedLine): { code: string; description: string; amount: number } | null {
  // Strategy 1: check line items
  if (line.items.length >= 2) {
    let amountIndex = -1
    let parsedAmount: number | undefined
    for (let index = line.items.length - 1; index >= 0; index--) {
      const item = line.items[index]
      const text = item.text.trim()
      if (AMOUNT_ONLY_PATTERN.test(text)) {
        const val = parseImssMoney(text)
        if (val !== undefined) {
          amountIndex = index
          parsedAmount = val
          break
        }
      }
    }

    if (amountIndex >= 1 && parsedAmount !== undefined) {
      const firstItem = line.items[0]
      const firstText = firstItem.text.trim()
      const codeMatch = firstText.match(/^([A-Za-z0-9]{2,4})\b/)
      let code: string | null = null
      let descStartIndex = 0
      let extraDesc = ""

      if (codeMatch && (isConceptCode(codeMatch[1]) || /^[A-Za-z0-9]{2,4}$/.test(codeMatch[1]))) {
        code = codeMatch[1]
        if (firstText.length > code.length) {
          extraDesc = firstText.slice(code.length).trim()
          descStartIndex = 1
        } else {
          descStartIndex = 1
        }
      }

      if (code) {
        const descParts: string[] = []
        if (extraDesc) descParts.push(extraDesc)
        for (let j = descStartIndex; j < amountIndex; j++) {
          const t = line.items[j].text.trim()
          if (t) descParts.push(t)
        }
        const description = descParts.join(" ").trim()
        if (description) {
          return { code, description, amount: parsedAmount }
        }
      }
    }
  }

  // Strategy 2: full line regex match
  const lineText = line.text.trim()
  const match = lineText.match(ROW_PATTERN)
  if (match) {
    const code = match[1]
    const description = match[2].trim()
    const amount = parseImssMoney(match[3])
    if (amount !== undefined && description) {
      return { code, description, amount }
    }
  }

  return null
}

function isTableHeader(line: ReconstructedLine): boolean {
  const norm = normalizeText(line.text)
  return (
    norm.includes("CONCEPTO DESCRIPCION IMPORTE") ||
    norm.includes("CONCEPTO IMPORTE") ||
    norm === "CONCEPTO" ||
    norm === "DESCRIPCION" ||
    norm === "IMPORTE" ||
    norm === "PERCEPCIONES" ||
    norm === "DEDUCCIONES" ||
    norm === "PERCEPCION" ||
    norm === "DEDUCCION"
  )
}

function parseLinesBetweenTotals(
  lines: ReconstructedLine[],
  startAnchor: string,
  totalAnchor: string,
  kind: "earning" | "deduction",
  warnings: string[],
  lineIndexOffset = 0,
  isExclusiveColumn = false,
): TarjetonConceptLine[] {
  const result: TarjetonConceptLine[] = []
  if (lines.length === 0) return result

  const shortAnchor = startAnchor.slice(0, 5) // "PERCE" o "DEDUC"
  const startIdx = lines.findIndex(
    (line) => !line.norm.includes("TOTAL") && (line.norm.includes(startAnchor) || line.norm.includes(shortAnchor))
  )

  let start: number
  if (startIdx >= 0) {
    start = startIdx
  } else if (isExclusiveColumn) {
    // If lines are exclusive to this column, start from the beginning
    start = -1
  } else if (kind === "earning") {
    start = -1
  } else {
    // Sequential lines without DEDUCCIONES anchor: cannot identify where deductions start
    return result
  }

  const shortTotalAnchor = totalAnchor.replace("TOTAL ", "").slice(0, 5)
  const searchStart = start + 1
  const relativeEnd = lines.slice(searchStart).findIndex((line) =>
    line.norm.includes(totalAnchor) ||
    (line.norm.includes("TOTAL") && line.norm.includes(shortTotalAnchor)) ||
    (kind === "earning" && !isExclusiveColumn && line.norm.includes("DEDUCCION")) ||
    line.norm.includes("LIQUIDO") ||
    line.norm.includes("NETO")
  )
  const end = relativeEnd < 0 ? lines.length : searchStart + relativeEnd

  for (let i = searchStart; i < end; i++) {
    const line = lines[i]
    if (line.norm.includes("TOTAL") || line.norm.includes("LIQUIDO") || line.norm.includes("NETO")) continue
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
    const match = line.text.match(/(-?\$?\s*[\d\s,]+(?:\.\d{2})?)\s*$/)
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
  const isExclusive = earningsLines !== deductionLines

  const earnings = parseLinesBetweenTotals(
    earningsLines,
    "PERCEPCIONES",
    "TOTAL PERCEPCIONES",
    "earning",
    warnings,
    0,
    isExclusive,
  )
  const deductions = parseLinesBetweenTotals(
    deductionLines,
    "DEDUCCIONES",
    "TOTAL DEDUCCIONES",
    "deduction",
    warnings,
    earnings.length,
    isExclusive,
  )

  let totalEarnings = extractTotal(earningsLines, "TOTAL PERCEPCIONES")
  if (totalEarnings === undefined && isExclusive) {
    totalEarnings = extractTotal(deductionLines, "TOTAL PERCEPCIONES")
  }

  let totalDeductions = extractTotal(deductionLines, "TOTAL DEDUCCIONES")
  if (totalDeductions === undefined && isExclusive) {
    totalDeductions = extractTotal(earningsLines, "TOTAL DEDUCCIONES")
  }

  let netPay = extractTotal(deductionLines, "LIQUIDO")
  if (netPay === undefined && isExclusive) {
    netPay = extractTotal(earningsLines, "LIQUIDO")
  }

  // Accounting sanity check (in dev, without PII)
  if (process.env.NODE_ENV !== "production") {
    const sumEarnings = earnings.reduce((acc, c) => acc + c.amount, 0)
    const sumDeductions = deductions.reduce((acc, c) => acc + c.amount, 0)
    // eslint-disable-next-line no-console
    console.debug(`[IMSS Concept Parser] Found ${earnings.length} earnings ($${sumEarnings.toFixed(2)}), ${deductions.length} deductions ($${sumDeductions.toFixed(2)}), netPay: $${netPay ?? "N/A"}`)
  }

  return { earnings, deductions, totalEarnings, totalDeductions, netPay, warnings }
}
