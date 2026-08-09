/**
 * Parser de observaciones del tarjetón IMSS.
 *
 * Conserva todas las filas y los duplicados. Una observación puede
 * contener: código, importe, vencimiento, unidades, número de control,
 * cargo inicial y texto libre.
 */
import type { TarjetonObservation } from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { parseImssMoney } from "./money-parser"
import { isConceptCode, normalizeText } from "./positioned-text"

const OBS_PATTERN = /^(\d{3})\s+(.*)$/

type ObservationColumn = "conceptCode" | "amount" | "duePeriod" | "units" | "controlNumber" | "initialCharge" | "notes"

const COLUMN_LABELS: Array<{ column: ObservationColumn; labels: string[] }> = [
  { column: "conceptCode", labels: ["CONCEPTO"] },
  { column: "amount", labels: ["IMPORTE"] },
  { column: "duePeriod", labels: ["VENCIMIENTO"] },
  { column: "units", labels: ["UNIDADES"] },
  { column: "controlNumber", labels: ["NUM CONTROL", "NO CONTROL"] },
  { column: "initialCharge", labels: ["CARGO INICIAL"] },
  { column: "notes", labels: ["OBSERVACIONES"] },
]

function findColumnStarts(lines: ReconstructedLine[], start: number): Array<{ column: ObservationColumn; x: number }> {
  const starts: Array<{ column: ObservationColumn; x: number }> = []
  for (const line of lines.slice(start + 1, start + 4)) {
    for (const spec of COLUMN_LABELS) {
      if (starts.some((entry) => entry.column === spec.column)) continue
      for (const label of spec.labels) {
        const tokens = label.split(" ")
        for (let itemIndex = 0; itemIndex < line.items.length; itemIndex++) {
          const candidate = line.items.slice(itemIndex, itemIndex + tokens.length).map((item) => item.norm).join(" ")
          if (candidate.includes(label)) {
            starts.push({ column: spec.column, x: line.items[itemIndex].x })
            break
          }
        }
        if (starts.some((entry) => entry.column === spec.column)) break
      }
    }
  }
  return starts.sort((a, b) => a.x - b.x)
}

function positionedObservation(
  line: ReconstructedLine,
  columns: Array<{ column: ObservationColumn; x: number }>,
  lineIndex: number,
): TarjetonObservation | null {
  const codeItem = line.items.find((item) => isConceptCode(item.text))
  if (columns.length < 3) return null

  const cells = new Map<ObservationColumn, string[]>()
  for (const item of line.items) {
    let selected = columns[0]
    for (const column of columns) {
      if (item.x >= column.x) selected = column
      else break
    }
    const values = cells.get(selected.column) ?? []
    values.push(item.text.trim())
    cells.set(selected.column, values)
  }
  const value = (column: ObservationColumn) => cells.get(column)?.join(" ").trim()
  const amount = parseImssMoney(value("amount"))
  const units = parseImssMoney(value("units"))
  const charge = parseImssMoney(value("initialCharge"))
  // Reject non-sensical values (PDF artifacts can produce huge numbers)
  const initialCharge = charge !== undefined && Math.abs(charge) < 100_000_000 ? charge : undefined

  return {
    lineIndex,
    conceptCode: codeItem?.text.trim() ?? value("conceptCode") ?? "",
    amount,
    duePeriod: value("duePeriod") || undefined,
    units,
    controlNumber: value("controlNumber") || undefined,
    initialCharge,
    notes: value("notes") || undefined,
  }
}

export function parseImssObservations(lines: ReconstructedLine[]): TarjetonObservation[] {
  const result: TarjetonObservation[] = []

  const start = lines.findIndex((line) => line.norm.includes("OBSERVACIONES"))
  if (start < 0) return result
  const certificationOffset = lines.slice(start + 1).findIndex((line) => line.norm.includes("CERTIFICACION") || line.norm.includes("INFORMACION FISCAL"))
  const end = certificationOffset < 0 ? lines.length : start + 1 + certificationOffset
  const columns = findColumnStarts(lines, start)

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]
    if (line.norm.includes("OBSERVACIONES")) continue
    if (COLUMN_LABELS.some((spec) => spec.labels.some((label) => line.norm === label || line.norm.includes(`CONCEPTO ${label}`)))) continue
    const notesColumn = columns.find((column) => column.column === "notes")
    const previous = result[result.length - 1]
    if (previous && notesColumn && line.items.every((item) => item.x >= notesColumn.x)) {
      previous.notes = [previous.notes, line.text.trim()].filter(Boolean).join(" ")
      continue
    }
    const positioned = positionedObservation(line, columns, result.length)
    if (positioned) {
      result.push(positioned)
      continue
    }
    const text = line.text.trim()
    if (!text) continue

    const match = text.match(OBS_PATTERN)
    if (match) {
      const rest = match[2].trim()
      const obs: TarjetonObservation = {
        lineIndex: result.length,
        conceptCode: match[1],
        notes: rest || undefined,
      }

      // Importe al final de la línea: "055 400.00" o "055 RETROACTIVO 400.00"
      const amountMatch = rest.match(/(-?[\d\s,]+\.\d{2})\s*$/)
      if (amountMatch) {
        const amount = parseImssMoney(amountMatch[1])
        if (amount !== undefined) {
          obs.amount = amount
          obs.notes = rest.slice(0, rest.length - amountMatch[1].length).trim() || undefined
        }
      }

      // Vencimiento en formato "2026014" (se conserva el texto original).
      const dueMatch = rest.match(/\b(20\d{5,7})\b/)
      if (dueMatch) {
        obs.duePeriod = dueMatch[1]
      }

      // Unidades: "3 UNIDADES" o "3 UDS"
      const unitsMatch = rest.match(/\b(\d+)\s*(?:UNIDADES?|UDS?|DIAS)\b/i)
      if (unitsMatch) {
        obs.units = Number(unitsMatch[1])
      }

      // Número de control.
      const controlMatch = rest.match(/\bCONTROL[:\s]+(\d+)\b/i)
      if (controlMatch) {
        obs.controlNumber = controlMatch[1]
      }

      // Cargo inicial.
      const chargeMatch = rest.match(/\b(?:CARGO INICIAL|CARGO)\s*[:=]?\s*(-?[\d\s,]+\.\d{2})\b/i)
      if (chargeMatch) {
        const charge = parseImssMoney(chargeMatch[1])
        if (charge !== undefined) obs.initialCharge = charge
      }

      result.push(obs)
    } else {
      if (/^(?:PERCEPCIONES|DEDUCCIONES|TOTAL|LIQUIDO|FECHA|MENSAJES|CONCEPTO|IMPORTE|VENCIMIENTO|UNIDADES|NUM)/i.test(normalizeText(text))) continue
      result.push({ lineIndex: result.length, conceptCode: "", notes: text })
    }
  }

  return result
}
