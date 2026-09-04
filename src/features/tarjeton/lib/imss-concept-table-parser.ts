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

const ROW_PATTERN_MULTI = /^([A-Za-z0-9]{2,4})\s+([A-Za-z0-9]{2,4})\s+(.+?)\s+([-+]?\$?\s*[\d\s,]+(?:\.\d{1,2})?-?)\s+([-+]?\$?\s*[\d\s,]+(?:\.\d{1,2})?-?)\s*$/
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

function parseRow(line: ReconstructedLine): { code: string | null; description: string; amount: number } | null {
  // Strategy 1: check line items
  if (line.items.length >= 2) {
    const lastIdx = line.items.length - 1
    const lastItemText = line.items[lastIdx].text.trim()
    const prevItemText = lastIdx >= 1 ? line.items[lastIdx - 1].text.trim() : ""

    const lastIsAmount = AMOUNT_ONLY_PATTERN.test(lastItemText)
    const prevIsAmount = lastIdx >= 1 && AMOUNT_ONLY_PATTERN.test(prevItemText)

    if (lastIsAmount && prevIsAmount && line.items.length >= 4) {
      // CFDI gravado + exento: suma de ambos
      const amt1 = parseImssMoney(prevItemText) ?? 0
      const amt2 = parseImssMoney(lastItemText) ?? 0
      const combinedAmount = amt1 + amt2
      const amountIndex = lastIdx - 1

      // Verificar si item[0] es tipo SAT y item[1] es clave de concepto
      const firstText = line.items[0].text.trim()
      const secondText = line.items[1].text.trim()
      const firstIsCode = isConceptCode(firstText) || /^[A-Za-z0-9]{2,4}$/.test(firstText)
      const secondIsCode = isConceptCode(secondText) || /^[A-Za-z0-9]{2,4}$/.test(secondText)

      let code: string | null = firstText
      let descStart = 1
      if (firstIsCode && secondIsCode) {
        code = secondText
        descStart = 2
      } else if (!firstIsCode && !secondIsCode) {
        code = null
        descStart = 0
      }

      const descParts: string[] = []
      for (let j = descStart; j < amountIndex; j++) {
        const t = line.items[j].text.trim()
        if (t) descParts.push(t)
      }
      const description = descParts.join(" ").trim()
      if (description || code) {
        return {
          code,
          description: description || (code ? `Concepto ${code}` : "Concepto"),
          amount: combinedAmount,
        }
      }
    } else if (lastIsAmount) {
      const parsedAmount = parseImssMoney(lastItemText)
      if (parsedAmount !== undefined) {
        const amountIndex = lastIdx
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

        const descParts: string[] = []
        if (extraDesc) descParts.push(extraDesc)
        for (let j = descStartIndex; j < amountIndex; j++) {
          const t = line.items[j].text.trim()
          if (t) descParts.push(t)
        }
        const description = descParts.join(" ").trim()
        if (description || code) {
          return {
            code,
            description: description || (code ? `Concepto ${code}` : "Concepto"),
            amount: parsedAmount,
          }
        }
      }
    }
  }

  // Strategy 2: full line regex match (multi-amount, standard, and no-code)
  const lineText = line.text.trim()
  const matchMulti = lineText.match(ROW_PATTERN_MULTI)
  if (matchMulti) {
    const code = matchMulti[2]
    const description = matchMulti[3].trim()
    const amt1 = parseImssMoney(matchMulti[4]) ?? 0
    const amt2 = parseImssMoney(matchMulti[5]) ?? 0
    if (description || code) {
      return {
        code,
        description: description || `Concepto ${code}`,
        amount: amt1 + amt2,
      }
    }
  }

  const match = lineText.match(ROW_PATTERN)
  if (match) {
    const code = match[1]
    const description = match[2].trim()
    const amount = parseImssMoney(match[3])
    if (amount !== undefined && (description || code)) {
      return {
        code,
        description: description || `Concepto ${code}`,
        amount,
      }
    }
  }

  const matchNoCode = lineText.match(/^(.+?)\s+([-+]?\$?\s*[\d\s,]+(?:\.\d{1,2})?-?)\s*$/)
  if (matchNoCode) {
    const description = matchNoCode[1].trim()
    const amount = parseImssMoney(matchNoCode[2])
    if (amount !== undefined && description && !isTableHeader(line)) {
      return { code: null, description, amount }
    }
  }

  return null
}

function isTableHeader(line: ReconstructedLine): boolean {
  const norm = normalizeText(line.text)
  return (
    norm.includes("CONCEPTO DESCRIPCION IMPORTE") ||
    norm.includes("CONCEPTO IMPORTE") ||
    norm.includes("TIPO DE") ||
    norm.includes("IMPORTE GRAVADO") ||
    norm.includes("IMPORTE EXENTO") ||
    norm.includes("CLAVE CONCEPTO") ||
    norm === "CONCEPTO" ||
    norm === "DESCRIPCION" ||
    norm === "IMPORTE" ||
    norm === "PERCEPCIONES" ||
    norm === "DEDUCCIONES" ||
    norm === "PERCEPCION" ||
    norm === "DEDUCCION"
  )
}

interface ParsedLinesResult {
  concepts: TarjetonConceptLine[]
  candidatesCount: number
  rejected: Array<{ anonymizedText: string; reason: string }>
}

function parseLinesBetweenTotals(
  lines: ReconstructedLine[],
  startAnchor: string,
  totalAnchor: string,
  kind: "earning" | "deduction",
  warnings: string[],
  lineIndexOffset = 0,
  isExclusiveColumn = false,
): ParsedLinesResult {
  const result: TarjetonConceptLine[] = []
  const rejected: Array<{ anonymizedText: string; reason: string }> = []
  let candidatesCount = 0

  if (lines.length === 0) return { concepts: result, candidatesCount, rejected }

  const shortAnchor = startAnchor.slice(0, 5) // "PERCE" o "DEDUC"
  const startIdx = lines.findIndex(
    (line) =>
      !line.norm.includes("TOTAL") &&
      !line.norm.includes("SUMA") &&
      (line.norm.includes(startAnchor) || line.norm.includes(shortAnchor)),
  )

  let start: number
  if (startIdx >= 0) {
    start = startIdx
  } else if (isExclusiveColumn) {
    // If lines are exclusive to this column, start from the beginning
    start = -1
  } else {
    // Sequential lines without section anchor: cannot identify where concepts start
    return { concepts: result, candidatesCount, rejected }
  }

  const shortTotalAnchor = totalAnchor.replace("TOTAL ", "").replace("SUMA DE ", "").slice(0, 5)
  const searchStart = start + 1
  const relativeEnd = lines.slice(searchStart).findIndex((line) =>
    line.norm.includes(totalAnchor) ||
    (line.norm.includes("TOTAL") && line.norm.includes(shortTotalAnchor)) ||
    (line.norm.includes("SUMA") && line.norm.includes(shortTotalAnchor)) ||
    (kind === "earning" && !isExclusiveColumn && line.norm.includes("DEDUCCION")) ||
    line.norm.includes("LIQUIDO") ||
    line.norm.includes("NETO") ||
    line.norm.includes("SUBTOTAL") ||
    line.norm.includes("SELLO DIGITAL")
  )
  const end = relativeEnd < 0 ? lines.length : searchStart + relativeEnd

  for (let i = searchStart; i < end; i++) {
    const line = lines[i]
    if (
      line.norm.includes("TOTAL") ||
      line.norm.includes("SUMA DE") ||
      line.norm.includes("LIQUIDO") ||
      line.norm.includes("NETO") ||
      line.norm.includes("SUBTOTAL")
    ) {
      continue
    }
    if (
      line.norm.includes("PERCEPCIONES") ||
      line.norm.includes("DEDUCCIONES") ||
      line.norm.includes("OBSERVACIONES") ||
      line.norm.includes("SELLO")
    ) {
      continue
    }
    if (isTableHeader(line)) continue

    candidatesCount++

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
      rejected.push({
        anonymizedText: line.text.replace(/\d{4,}/g, "****").slice(0, 40),
        reason: "No se identificó importe ni continuación de texto.",
      })
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

  return { concepts: result, candidatesCount, rejected }
}

function extractTotal(lines: ReconstructedLine[], labelNorm: string): number | undefined {
  const shortLabel = labelNorm.replace("TOTAL ", "").replace("SUMA DE ", "").slice(0, 5)
  for (const line of lines) {
    const matchesLabel =
      line.norm.includes(labelNorm) ||
      (line.norm.includes("TOTAL") && line.norm.includes(shortLabel)) ||
      (line.norm.includes("SUMA") && line.norm.includes(shortLabel)) ||
      (labelNorm.includes("PERCEP") && (line.norm.includes("SUMA DE PERCEP") || line.norm.includes("SUBTOTAL"))) ||
      (labelNorm.includes("DEDUC") && (line.norm.includes("SUMA DE DEDUC") || line.norm.trim() === "DEDUCCIONES")) ||
      (labelNorm === "LIQUIDO" && (line.norm.includes("LIQUIDO") || line.norm.includes("NETO A PAGAR") || line.norm.includes("NETO")))
    if (!matchesLabel) continue

    const matches = Array.from(line.text.matchAll(/(-?\$?\s*[\d\s,]+(?:\.\d{2})?)/g))
    if (matches.length > 0) {
      const amounts = matches
        .map((m) => parseImssMoney(m[1]))
        .filter((v): v is number => v !== undefined && !isNaN(v))
      if (amounts.length === 1) return amounts[0]
      if (amounts.length > 1) {
        const nonZero = amounts.filter((a) => a !== 0)
        if (nonZero.length === 1) return nonZero[0]
        return Math.max(...amounts)
      }
    }
  }
  return undefined
}

export function parseImssConceptTables(
  earningsLines: ReconstructedLine[],
  deductionLines: ReconstructedLine[],
): ConceptTableResult {
  const warnings: string[] = []
  const isExclusive = earningsLines !== deductionLines

  const parsedEarnings = parseLinesBetweenTotals(
    earningsLines,
    "PERCEPCIONES",
    "TOTAL PERCEPCIONES",
    "earning",
    warnings,
    0,
    isExclusive,
  )
  const parsedDeductions = parseLinesBetweenTotals(
    deductionLines,
    "DEDUCCIONES",
    "TOTAL DEDUCCIONES",
    "deduction",
    warnings,
    parsedEarnings.concepts.length,
    isExclusive,
  )

  const earnings = parsedEarnings.concepts
  const deductions = parsedDeductions.concepts

  let totalEarnings = extractTotal(earningsLines, "TOTAL PERCEPCIONES")
  if (totalEarnings === undefined) {
    totalEarnings = extractTotal(earningsLines, "SUMA DE PERCEPCIONES") ?? extractTotal(earningsLines, "SUBTOTAL")
  }
  if (totalEarnings === undefined && isExclusive) {
    totalEarnings = extractTotal(deductionLines, "TOTAL PERCEPCIONES") ?? extractTotal(deductionLines, "SUMA DE PERCEPCIONES") ?? extractTotal(deductionLines, "SUBTOTAL")
  }

  let totalDeductions = extractTotal(deductionLines, "TOTAL DEDUCCIONES")
  if (totalDeductions === undefined) {
    totalDeductions = extractTotal(deductionLines, "SUMA DE DEDUCCIONES") ?? extractTotal(deductionLines, "DEDUCCIONES")
  }
  if (totalDeductions === undefined && isExclusive) {
    totalDeductions = extractTotal(earningsLines, "TOTAL DEDUCCIONES") ?? extractTotal(earningsLines, "SUMA DE DEDUCCIONES")
  }

  let netPay = extractTotal(deductionLines, "LIQUIDO")
  if (netPay === undefined) {
    netPay = extractTotal(deductionLines, "NETO A PAGAR") ?? extractTotal(deductionLines, "NETO")
  }
  if (netPay === undefined && isExclusive) {
    netPay = extractTotal(earningsLines, "LIQUIDO") ?? extractTotal(earningsLines, "NETO A PAGAR") ?? extractTotal(earningsLines, "NETO")
  }

  // Telemetría obligatoria en desarrollo (sin PII)
  if (process.env.NODE_ENV !== "production") {
    const textItems =
      earningsLines.reduce((s, l) => s + l.items.length, 0) +
      (isExclusive ? deductionLines.reduce((s, l) => s + l.items.length, 0) : 0)

    const perceptionHeaders = earningsLines.filter(isTableHeader).length
    const deductionHeaders = deductionLines.filter(isTableHeader).length

    console.debug("[IMSS Concept Table Telemetry]", {
      textItems,
      perceptionHeaders,
      deductionHeaders,
      perceptionRowCandidates: parsedEarnings.candidatesCount,
      deductionRowCandidates: parsedDeductions.candidatesCount,
      acceptedPerceptions: earnings.length,
      acceptedDeductions: deductions.length,
      rejectedRows: [...parsedEarnings.rejected, ...parsedDeductions.rejected],
    })
  }

  return { earnings, deductions, totalEarnings, totalDeductions, netPay, warnings }
}
