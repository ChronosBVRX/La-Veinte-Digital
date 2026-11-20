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

const OBS_PATTERN = /^(\d{2,3})\s+(.*)$/

type ObservationColumn = "conceptCode" | "amount" | "duePeriod" | "units" | "controlNumber" | "initialCharge" | "notes"

const COLUMN_LABELS: Array<{ column: ObservationColumn; labels: string[] }> = [
  { column: "conceptCode", labels: ["CONCEPTO"] },
  { column: "amount", labels: ["IMPORTE"] },
  { column: "duePeriod", labels: ["VENCIMIENTO"] },
  { column: "units", labels: ["UNIDADES", "UNIDAD", "UDS", "HORAS", "HRS"] },
  { column: "controlNumber", labels: ["NUM CONTROL", "NO CONTROL", "NUM. CONTROL", "NUMERO CONTROL", "CONTROL"] },
  { column: "initialCharge", labels: ["CARGO INICIAL", "CARGO"] },
  { column: "notes", labels: ["OBSERVACIONES", "OBSERVACION", "OBS.", "OBS"] },
]

export function parseObservationUnits(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const input = raw.trim()
  if (!input) return undefined

  // 1. Si es puramente numérico, parseImssMoney devuelve el número
  const money = parseImssMoney(input)
  if (money !== undefined && money >= 0) {
    return Math.round(money)
  }

  // 2. Extraer dígitos con unidades o prefijo/sufijo (ej: "8.0 HRS", "8 HORAS", "8 HRS", "8 UDS")
  const match =
    input.match(/^(\d+(?:\.\d+)?)\s*(?:HRS?|HORAS?|UNIDADES?|UDS?|DIAS?)?$/i) ||
    input.match(/\b(\d+(?:\.\d+)?)\s*(?:HRS?|HORAS?|UNIDADES?|UDS?)\b/i)
  if (match) {
    const num = Number(match[1])
    if (Number.isFinite(num) && num >= 0) {
      return Math.round(num)
    }
  }

  return undefined
}

function findColumnStarts(lines: ReconstructedLine[], start: number): Array<{ column: ObservationColumn; x: number }> {
  let headerIndex = -1
  for (let i = start + 1; i < Math.min(lines.length, start + 5); i++) {
    if (lines[i].norm.includes("CONCEPTO") && (lines[i].norm.includes("IMPORTE") || lines[i].norm.includes("VENCIMIENTO"))) {
      headerIndex = i
      break
    }
  }

  if (headerIndex < 0) return []

  const starts: Array<{ column: ObservationColumn; x: number }> = []
  const line = lines[headerIndex]

  for (const spec of COLUMN_LABELS) {
    if (starts.some((entry) => entry.column === spec.column)) continue
    for (const label of spec.labels) {
      const tokens = label.split(" ")
      for (let itemIndex = 0; itemIndex < line.items.length; itemIndex++) {
        if (!line.items[itemIndex].norm.includes(tokens[0])) continue
        const candidate = line.items.slice(itemIndex, itemIndex + tokens.length).map((item) => item.norm).join(" ")
        if (candidate.includes(label)) {
          starts.push({ column: spec.column, x: line.items[itemIndex].x })
          break
        }
      }
      if (starts.some((entry) => entry.column === spec.column)) break
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
  let units = parseObservationUnits(value("units"))
  let duePeriod = value("duePeriod") || undefined
  let controlNumber = value("controlNumber") || undefined
  const charge = parseImssMoney(value("initialCharge"))
  // Reject non-sensical values (PDF artifacts can produce huge numbers)
  const initialCharge = charge !== undefined && Math.abs(charge) < 100_000_000 ? charge : undefined
  let notes = value("notes") || undefined

  // Post-procesamiento semántico para evitar desfasamientos entre columnas:
  // 1. Si duePeriod recibió un número pequeño de unidades (1 a 500) y no es código quincenal (20\d{5})
  if (units === undefined && duePeriod) {
    const pUnits = parseObservationUnits(duePeriod)
    if (pUnits !== undefined && pUnits <= 500 && !/^(19|20)\d{4,6}$/.test(duePeriod)) {
      units = pUnits
      duePeriod = undefined
    }
  }

  // 2. Si duePeriod contiene en realidad una fecha civil de 8 dígitos (ej. 16092026) o rango:
  if (duePeriod && (/^\d{8}$/.test(duePeriod) || /\d{8}-\d{8}/.test(duePeriod) || /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(duePeriod))) {
    if (!controlNumber) controlNumber = duePeriod
    if (!notes) notes = duePeriod
    duePeriod = undefined
  }

  // 3. Si units cayó en un valor que en realidad es una fecha (ej. 16092026) o rango:
  const rawUnitsStr = value("units")
  if (rawUnitsStr && (/^\d{8}$/.test(rawUnitsStr) || /\d{8}-\d{8}/.test(rawUnitsStr) || /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(rawUnitsStr))) {
    if (!controlNumber) controlNumber = rawUnitsStr
    if (!notes) notes = rawUnitsStr
    units = undefined
  }

  // 4. Si controlNumber es un entero pequeño (1 a 48) y units está vacío:
  if (units === undefined && controlNumber) {
    const pUnits = parseObservationUnits(controlNumber)
    if (pUnits !== undefined && pUnits <= 500 && !/^(19|20)\d{2}/.test(controlNumber) && !/^\d{7,8}$/.test(controlNumber)) {
      units = pUnits
      controlNumber = undefined
    }
  }

  // 5. Asegurar que las fechas en controlNumber se conserven en notes si notes está vacío:
  if (controlNumber && !notes) {
    notes = controlNumber
  }

  const rawCode = codeItem?.text.trim() ?? value("conceptCode") ?? ""
  if (!isConceptCode(rawCode)) return null

  return {
    lineIndex,
    conceptCode: rawCode,
    amount,
    duePeriod,
    units,
    controlNumber,
    initialCharge,
    notes,
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
    if (line.norm.includes("OBSERVACIONES") && !line.norm.includes("CONCEPTO")) continue
    if (line.norm.includes("CONCEPTO") && (line.norm.includes("IMPORTE") || line.norm.includes("VENCIMIENTO"))) continue
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

      // 1. Extraer rango de fechas o fechas civiles (ej. 16092026-16092026, 16092026, QI 18)
      let dateFound: string | undefined
      const dateRangeMatch = rest.match(/\b(\d{8}\s*[-ALa\s]+\s*\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*[-ALa\s]+\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|QI\s*\d+)\b/i)
      if (dateRangeMatch) {
        dateFound = dateRangeMatch[1]
      } else {
        const singleDateMatch = rest.match(/\b(\d{8}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)
        if (singleDateMatch) {
          dateFound = singleDateMatch[1]
        }
      }
      if (dateFound) {
        obs.controlNumber = dateFound
      }

      // 2. Extraer importes monetarios (con punto decimal)
      const moneyMatches = [...rest.matchAll(/(-?[\d,]+\.\d{2})\b/g)]
      if (moneyMatches.length >= 1) {
        const parsedAmt = parseImssMoney(moneyMatches[0][1])
        if (parsedAmt !== undefined) obs.amount = parsedAmt
      }
      if (moneyMatches.length >= 2) {
        const parsedCharge = parseImssMoney(moneyMatches[1][1])
        if (parsedCharge !== undefined) {
          obs.initialCharge = parsedCharge
        }
      }

      // 3. Vencimiento quincenal (7 dígitos iniciando con 20\d{5})
      const dueMatch = rest.match(/\b(20\d{5})\b/)
      if (dueMatch && dueMatch[1] !== dateFound) {
        obs.duePeriod = dueMatch[1]
      }

      // 4. Unidades: explícitas (ej. "8 HRS", "3 UNIDADES") o número entero pequeño aislado (1 a 500)
      const explicitUnits = rest.match(/\b(\d+(?:\.\d+)?)\s*(?:UNIDADES?|UDS?|DIAS|HORAS|HRS)\b/i)
      if (explicitUnits) {
        obs.units = parseObservationUnits(explicitUnits[0])
      } else {
        // Buscar entero aislado que no sea código de concepto, ni importe, ni fecha, ni vencimiento
        const tokens = rest.split(/\s+/)
        for (const tok of tokens) {
          if (tok === obs.duePeriod || tok === dateFound) continue
          if (moneyMatches.some((m) => m[1] === tok || tok.includes("."))) continue
          const n = Number(tok)
          if (Number.isInteger(n) && n > 0 && n <= 500 && tok.length <= 3) {
            obs.units = n
            break
          }
        }
      }

      // 5. Número de control explícito
      const explicitControl = rest.match(/\bCONTROL[:\s]+(\S+)\b/i)
      if (explicitControl) {
        obs.controlNumber = explicitControl[1]
      }

      // 6. Cargo inicial explícito
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
