/**
 * Parser del perfil laboral del tarjetón IMSS (página 1).
 *
 * Extrae pares etiqueta→valor apoyándose en las líneas reconstruidas.
 * Soporta valores multilínea (adscripción) y solo acepta valores cuando
 * la etiqueta ancla está presente (nunca adivina campos ausentes).
 */
import type { ExtractedTarjetonField, ParsedImssTarjeton, TarjetonExtractionMethod } from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { parseImssMoney } from "./money-parser"
import { parseImssDate } from "./imss-date-parser"
import { baseFieldConfidence, multilineAdjustment, clampConfidence, requiresReviewForConfidence } from "./confidence"

type Employee = ParsedImssTarjeton["employee"]

export interface ProfileParseResult {
  employee: Employee
  /** Campo por clave interna (para depuración y revisión). */
  fields: Record<string, ExtractedTarjetonField<string | number | null>>
  warnings: string[]
}

interface LabelSpec {
  key: keyof Employee & string
  labels: string[]
  kind: "text" | "number" | "date"
  critical?: boolean
  /** Líneas de continuación permitidas cuando el valor no está en la misma fila. */
  maxContinuations?: number
}

const LABEL_SPECS: LabelSpec[] = [
  { key: "employeeNumber", labels: ["MATRICULA"], kind: "text", critical: true },
  { key: "fullName", labels: ["NOMBRE"], kind: "text" },
  { key: "employmentType", labels: ["TIPO DE CONTRATACION"], kind: "text" },
  { key: "assignmentCode", labels: ["CLAVE DE ADSCRIPCION"], kind: "text" },
  { key: "assignmentName", labels: ["NOMBRE DE ADSCRIPCION", "ADSCRIPCION"], kind: "text", maxContinuations: 2 },
  { key: "location", labels: ["UBICACION"], kind: "text" },
  { key: "organizationalCode", labels: ["CLAVE DE ESTRUCTURA ORGANIZACIONAL", "ESTRUCTURA ORG"], kind: "text" },
  { key: "categoryCode", labels: ["CLAVE DE CATEGORIA/PUESTO", "CLAVE CATEGORIA"], kind: "text", critical: true },
  { key: "categoryName", labels: ["NOMBRE CATEGORIA/PUESTO", "NOMBRE DE CATEGORIA", "CATEGORIA/PUESTO"], kind: "text", critical: true, maxContinuations: 1 },
  { key: "plaza", labels: ["PLAZA"], kind: "text" },
  { key: "entryDate", labels: ["FECHA DE INGRESO"], kind: "date", critical: true },
]

const VALID_WORKDAY_HOURS = [6, 6.5, 8, 12] as const

/** "TECNICO RADIOLOGO 80" → 8; "ENFERMERA 65" → 6.5; "CAT 120" → 12. */
export function deriveWorkdayHoursFromCategoryName(categoryName: string): number | null {
  const match = categoryName.trim().match(/(\d+)\s*$/)
  if (!match) return null
  const hours = Number(match[1]) / 10
  return (VALID_WORKDAY_HOURS as readonly number[]).includes(hours) ? hours : null
}

function cleanValue(raw: string): string {
  return raw
    .replace(/^[\s:;.\-–—]+/, "")
    .replace(/[\s:;.\-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

interface RawFieldValue {
  value: string | null
  page: number
  confidence: number
  method: TarjetonExtractionMethod
  multiline: boolean
}

/**
 * Etiqueta más específica presente en la línea (la de mayor longitud).
 * Garantiza que "CLAVE DE CATEGORIA/PUESTO" gane sobre "CATEGORIA/PUESTO"
 * y que "NOMBRE DE ADSCRIPCION" gane sobre "ADSCRIPCION".
 */
function longestLabelForLine(line: ReconstructedLine, extraLabels: string[]): string | null {
  let longest: string | null = null
  for (const spec of LABEL_SPECS) {
    for (const label of spec.labels) {
      if (line.norm.includes(label) && (longest === null || label.length > longest.length)) {
        longest = label
      }
    }
  }
  for (const label of extraLabels) {
    if (line.norm.includes(label) && (longest === null || label.length > longest.length)) {
      longest = label
    }
  }
  return longest
}

function readLabelValue(lines: ReconstructedLine[], spec: LabelSpec): RawFieldValue | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const label of spec.labels) {
      const idx = line.norm.indexOf(label)
      if (idx < 0) continue

      // Solo la etiqueta más específica de la línea puede reclamarla:
      // evita que "CATEGORIA/PUESTO" capture la fila "CLAVE DE CATEGORIA/PUESTO".
      if (label !== longestLabelForLine(line, spec.labels)) continue

      const after = cleanValue(line.text.slice(idx + label.length))
      if (after) {
        return {
          value: after,
          page: line.page,
          confidence: baseFieldConfidence(line.method, line.confidence),
          method: line.method,
          multiline: false,
        }
      }

      // Valor en la siguiente línea (multilínea).
      if (spec.maxContinuations && spec.maxContinuations > 0) {
        const continuation: string[] = []
        let confidences = line.confidence
        const page = line.page
        const method = line.method
        for (let j = i + 1; j <= i + spec.maxContinuations && j < lines.length; j++) {
          const next = lines[j]
          // No cruzar a otra sección: detenerse ante un nuevo ancla de etiqueta.
          if (next.norm.includes("PERCEPCIONES") || next.norm.includes("DEDUCCIONES") || next.norm.includes("OBSERVACIONES")) break
          if (next.y - line.y > 24 && j === i + 1) break
          const text = cleanValue(next.text)
          if (!text) continue
          continuation.push(text)
          confidences += next.confidence
        }
        if (continuation.length > 0) {
          const joined = continuation.join(" ")
          return {
            value: joined,
            page,
            confidence: multilineAdjustment(
              clampConfidence(confidences / (continuation.length + 1)),
              true,
            ),
            method,
            multiline: true,
          }
        }
      }

      return { value: null, page: line.page, confidence: line.confidence, method: line.method, multiline: false }
    }
  }
  return null
}

export function parseImssProfile(lines: ReconstructedLine[], method: TarjetonExtractionMethod): ProfileParseResult {
  const employee: Employee = {}
  const fields: ProfileParseResult["fields"] = {}
  const warnings: string[] = []

  for (const spec of LABEL_SPECS) {
    const raw = readLabelValue(lines, spec)
    if (!raw || raw.value === null) continue

    let value: string | number | null = null
    if (spec.kind === "number") {
      value = parseImssMoney(raw.value) ?? null
    } else if (spec.kind === "date") {
      value = parseImssDate(raw.value) ?? null
    } else {
      value = raw.value
    }

    if (value === null) {
      warnings.push(`El campo ${spec.key} no pudo interpretarse (valor: "${raw.value}")`)
      continue
    }

    // @ts-expect-error -- asignación genérica validada por la spec
    employee[spec.key] = value
    fields[spec.key] = {
      value: value as never,
      rawValue: raw.value,
      page: raw.page,
      confidence: raw.confidence,
      method: raw.method,
      requiresReview: requiresReviewForConfidence(raw.confidence, spec.critical ?? false),
    }
  }

  // Jornada: etiqueta explícita o sufijo de la categoría.
  const jornadaRaw = readLabelValue(lines, { key: "workdayHours", labels: ["JORNADA"], kind: "number" })
  if (jornadaRaw?.value !== null && jornadaRaw?.value !== undefined) {
    const hours = parseImssMoney(jornadaRaw.value)
    if (hours !== undefined && (VALID_WORKDAY_HOURS as readonly number[]).includes(hours)) {
      employee.workdayHours = hours
      fields.workdayHours = {
        value: hours,
        rawValue: jornadaRaw.value,
        page: jornadaRaw.page,
        confidence: jornadaRaw.confidence,
        method: jornadaRaw.method,
        requiresReview: requiresReviewForConfidence(jornadaRaw.confidence, false),
      }
    }
  } else if (employee.categoryName) {
    const derived = deriveWorkdayHoursFromCategoryName(employee.categoryName)
    if (derived !== null) {
      employee.workdayHours = derived
      fields.workdayHours = {
        value: derived,
        rawValue: employee.categoryName,
        page: fields.categoryName?.page ?? 1,
        confidence: 0.8,
        method: fields.categoryName?.method ?? method,
        requiresReview: true,
      }
    }
  }

  // Antigüedad efectiva: se devuelve cruda; el orquestador la interpreta
  // con parseImssPayslipSeniority (el tarjetón usa quincenas).
  const seniorityRaw = readLabelValue(lines, { key: "seniority", labels: ["ANTIGUEDAD EFECTIVA"], kind: "text", critical: true })
  if (seniorityRaw?.value !== null && seniorityRaw?.value !== undefined) {
    fields.seniority = {
      value: null,
      rawValue: seniorityRaw.value,
      page: seniorityRaw.page,
      confidence: seniorityRaw.confidence,
      method: seniorityRaw.method,
      requiresReview: requiresReviewForConfidence(seniorityRaw.confidence, true),
    }
  }

  return { employee, fields, warnings }
}

/** Extrae el texto crudo de la antigüedad efectiva (p. ej. "14 años 3 qnas 1 días"). */
export function extractSeniorityRaw(lines: ReconstructedLine[]): string | null {
  const spec: LabelSpec = { key: "seniority", labels: ["ANTIGUEDAD EFECTIVA"], kind: "text" }
  const raw = readLabelValue(lines, spec)
  return raw?.value ?? null
}
