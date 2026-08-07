/**
 * Parser del perfil laboral del tarjetón IMSS (página 1).
 *
 * El tarjetón se usa únicamente para los campos que representa de forma
 * inequívoca. La adscripción del perfil no se importa desde este documento.
 */
import type {
  ExtractedTarjetonField,
  ParsedImssTarjeton,
  TarjetonExtractionMethod,
} from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { parseImssMoney } from "./money-parser"
import { parseImssDate } from "./imss-date-parser"
import {
  baseFieldConfidence,
  multilineAdjustment,
  clampConfidence,
  requiresReviewForConfidence,
} from "./confidence"
import { normalizeText, normalizeWithIndexMap } from "./positioned-text"

type Employee = ParsedImssTarjeton["employee"]

export interface ProfileParseResult {
  employee: Employee
  fields: Record<string, ExtractedTarjetonField<string | number | null>>
  warnings: string[]
}

interface LabelSpec {
  key: keyof Employee & string
  labels: string[]
  kind: "text" | "number" | "date"
  critical?: boolean
  maxContinuations?: number
}

const LABEL_SPECS: LabelSpec[] = [
  { key: "employeeNumber", labels: ["MATRICULA"], kind: "text", critical: true },
  { key: "fullName", labels: ["NOMBRE"], kind: "text", critical: true },
  { key: "employmentType", labels: ["TIPO DE CONTRATACION"], kind: "text" },
  { key: "location", labels: ["UBICACION"], kind: "text" },
  {
    key: "organizationalCode",
    labels: ["CLAVE EST. ORG", "CLAVE DE ESTRUCTURA ORGANIZACIONAL", "ESTRUCTURA ORG"],
    kind: "text",
  },
  {
    key: "categoryCode",
    labels: ["CLAVE CATEGORIA/PUESTO", "CLAVE DE CATEGORIA/PUESTO", "CLAVE CATEGORIA"],
    kind: "text",
    critical: true,
  },
  {
    key: "categoryName",
    labels: ["NOMBRE CATEGORIA/PUESTO", "NOMBRE DE CATEGORIA/PUESTO", "NOMBRE DE CATEGORIA"],
    kind: "text",
    critical: true,
    maxContinuations: 1,
  },
  { key: "plaza", labels: ["PLAZA"], kind: "text" },
  { key: "entryDate", labels: ["FECHA DE INGRESO"], kind: "date", critical: true },
]

const PROFILE_LABELS = LABEL_SPECS.flatMap((spec) => spec.labels).concat([
  "JORNADA",
  "ANTIGUEDAD EFECTIVA",
  "UBICACION",
  "CLAVE DE ADSCRIPCION",
  "NOMBRE DE ADSCRIPCION",
])

function containsAnotherLabel(value: string): boolean {
  const normalized = normalizeText(value)
  return PROFILE_LABELS.some((label) => normalized.includes(normalizeText(label)))
}

const VALID_WORKDAY_HOURS = [6, 6.5, 8, 12] as const

/** "TECNICO RADIOLOGO 80" → 8; "ENFERMERA 65" → 6.5. */
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

function longestLabelForLine(line: ReconstructedLine, extraLabels: string[] = []): string | null {
  let longest: string | null = null
  for (const label of [...PROFILE_LABELS, ...extraLabels]) {
    const normalized = normalizeText(label)
    if (line.norm.includes(normalized) && (longest === null || normalized.length > longest.length)) {
      longest = normalized
    }
  }
  return longest
}

function valueOnAnchorLine(line: ReconstructedLine, label: string): string {
  const normalizedLabel = normalizeText(label)
  const anchorItemIndex = line.items.findIndex((item) => item.norm.includes(normalizedLabel))
  if (anchorItemIndex >= 0) {
    const anchorItem = line.items[anchorItemIndex]
    const { normalized, normToRaw } = normalizeWithIndexMap(anchorItem.text)
    const labelIndex = normalized.indexOf(normalizedLabel)
    if (labelIndex < 0) return ""
    const rawStart = normToRaw[labelIndex + normalizedLabel.length] ?? anchorItem.text.length
    const values = [cleanValue(anchorItem.text.slice(rawStart))]
    for (const item of line.items.slice(anchorItemIndex + 1)) {
      if (PROFILE_LABELS.some((knownLabel) => item.norm.includes(normalizeText(knownLabel)))) break
      values.push(cleanValue(item.text))
    }
    return values.filter(Boolean).join(" ")
  }

  const { normalized, normToRaw } = normalizeWithIndexMap(line.text)
  const normalizedIndex = normalized.indexOf(normalizedLabel)
  if (normalizedIndex < 0) return ""
  const rawStart = normToRaw[normalizedIndex + normalizedLabel.length] ?? line.text.length
  return cleanValue(line.text.slice(rawStart))
}

function readLabelValue(lines: ReconstructedLine[], spec: LabelSpec): RawFieldValue | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const label of spec.labels) {
      const normalizedLabel = normalizeText(label)
      const idx = line.norm.indexOf(normalizedLabel)
      if (idx < 0 || normalizedLabel !== longestLabelForLine(line, spec.labels)) continue

      const after = valueOnAnchorLine(line, label)
      if (after) {
        return {
          value: after,
          page: line.page,
          confidence: baseFieldConfidence(line.method, line.confidence),
          method: line.method,
          multiline: false,
        }
      }

      if (spec.maxContinuations && spec.maxContinuations > 0) {
        const continuation: string[] = []
        let confidences = line.confidence
        for (let j = i + 1; j <= i + spec.maxContinuations && j < lines.length; j++) {
          const next = lines[j]
          if (
            next.norm.includes("PERCEPCIONES") ||
            next.norm.includes("DEDUCCIONES") ||
            next.norm.includes("OBSERVACIONES") ||
            longestLabelForLine(next, spec.labels)
          ) {
            break
          }
          if (next.page !== line.page || next.y - line.y > Math.max(24, line.yMax - line.yMin + 12)) break
          if (Math.abs(next.xMin - line.xMin) > 80) break
          const text = cleanValue(next.text)
          if (!text) continue
          continuation.push(text)
          confidences += next.confidence
        }
        if (continuation.length > 0) {
          return {
            value: continuation.join(" "),
            page: line.page,
            confidence: multilineAdjustment(
              clampConfidence(confidences / (continuation.length + 1)),
              true,
            ),
            method: line.method,
            multiline: true,
          }
        }
      }

      return {
        value: null,
        page: line.page,
        confidence: line.confidence,
        method: line.method,
        multiline: false,
      }
    }
  }
  return null
}

export function parseImssProfile(
  lines: ReconstructedLine[],
  method: TarjetonExtractionMethod,
): ProfileParseResult {
  const employee: Employee = {}
  const fields: ProfileParseResult["fields"] = {}
  const warnings: string[] = []

  for (const spec of LABEL_SPECS) {
    const raw = readLabelValue(lines, spec)
    if (!raw || raw.value === null) continue

    let value: string | number | null
    if (spec.kind === "number") value = parseImssMoney(raw.value) ?? null
    else if (spec.kind === "date") value = parseImssDate(raw.value) ?? null
    else value = raw.value

    if (value === null) {
      warnings.push(`No se pudo interpretar ${spec.key}.`)
      continue
    }

    const contaminated = containsAnotherLabel(raw.value)
    const confidence = contaminated ? clampConfidence(raw.confidence - 0.4) : raw.confidence
    if (contaminated) warnings.push(`Revisa el dato detectado para ${spec.key}.`)

    // @ts-expect-error -- asignación genérica validada por LabelSpec.
    employee[spec.key] = value
    fields[spec.key] = {
      value: value as never,
      rawValue: raw.value,
      page: raw.page,
      confidence,
      method: raw.method,
      requiresReview:
        contaminated || requiresReviewForConfidence(confidence, spec.critical ?? false),
    }
  }

  const jornadaRaw = readLabelValue(lines, {
    key: "workdayHours",
    labels: ["JORNADA"],
    kind: "number",
  })
  let workdayResolved = false
  if (jornadaRaw?.value !== null && jornadaRaw?.value !== undefined) {
    const hours = parseImssMoney(jornadaRaw.value)
    if (hours !== undefined && (VALID_WORKDAY_HOURS as readonly number[]).includes(hours)) {
      employee.workdayHours = hours
      workdayResolved = true
      fields.workdayHours = {
        value: hours,
        rawValue: jornadaRaw.value,
        page: jornadaRaw.page,
        confidence: jornadaRaw.confidence,
        method: jornadaRaw.method,
        requiresReview: requiresReviewForConfidence(jornadaRaw.confidence, false),
      }
    }
  }
  if (!workdayResolved && employee.categoryName) {
    const derived = deriveWorkdayHoursFromCategoryName(employee.categoryName)
    if (derived !== null) {
      employee.workdayHours = derived
      fields.workdayHours = {
        value: derived,
        rawValue: employee.categoryName,
        page: fields.categoryName?.page ?? 1,
        confidence: fields.categoryName?.confidence ?? 0.9,
        method: fields.categoryName?.method ?? method,
        requiresReview: fields.categoryName?.requiresReview ?? false,
      }
    }
  }

  const seniorityRaw = readLabelValue(lines, {
    key: "seniority",
    labels: ["ANTIGUEDAD EFECTIVA"],
    kind: "text",
    critical: true,
  })
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

export function extractSeniorityRaw(lines: ReconstructedLine[]): string | null {
  const raw = readLabelValue(lines, {
    key: "seniority",
    labels: ["ANTIGUEDAD EFECTIVA"],
    kind: "text",
  })
  return raw?.value ?? null
}
