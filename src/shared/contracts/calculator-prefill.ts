/**
 * Contrato compartido del sistema de prerrelleno normativo para calculadoras IMSS.
 *
 * Este archivo NO contiene lógica de negocio: solo tipos y validadores.
 * La lógica vive en el motor de nómina (features/nomina) y la política por
 * calculadora; los consumidores están en features/calculators.
 */

export type CalculatorId =
  | "aguinaldo"
  | "clausula-97"
  | "prestamos"
  | "segunda-julio"
  | "segunda-julio-proporcional"
  | "tiempo-extra"

export const CALCULATOR_IDS: readonly CalculatorId[] = [
  "aguinaldo",
  "clausula-97",
  "prestamos",
  "segunda-julio",
  "segunda-julio-proporcional",
  "tiempo-extra",
] as const

export type PrefillSource =
  | "salary_table"
  | "contract_rule"
  | "regulation_rule"
  | "profile"
  | "last_payslip"
  | "multiple_payslips"
  | "user_confirmation"
  | "calculated"

export type PrefillConfidence = "high" | "medium" | "requires_confirmation"

export interface PrefillField<T> {
  value: T
  source: PrefillSource
  confidence: PrefillConfidence
  effectiveAt: string
  editable: boolean
  ruleVersion?: string
  legalReference?: string
  warning?: string
}

export interface CalculatorPrefillFields {
  categoryId?: PrefillField<string>
  categoryName?: PrefillField<string>

  concepto002?: PrefillField<number>
  concepto011?: PrefillField<number>
  concepto020?: PrefillField<number>
  concepto022?: PrefillField<number>
  concepto023?: PrefillField<number>
  concepto050?: PrefillField<number>
  concepto054?: PrefillField<number>
  concepto063?: PrefillField<number>

  workdayHours?: PrefillField<number>
  seniorityYears?: PrefillField<number>
  effectiveSeniorityDate?: PrefillField<string>
  daysWorkedInAnnualPeriod?: PrefillField<number>
}

export type CategoryResolutionStatus =
  | "resolved"
  | "ambiguous"
  | "not_found"
  | "missing_profile"

export interface CalculatorPrefillResponse {
  schemaVersion: "1.0"
  calculatorId: CalculatorId
  targetDate: string
  generatedAt: string

  categoryResolved: boolean
  categoryResolutionStatus: CategoryResolutionStatus

  fields: CalculatorPrefillFields

  missingFacts: string[]
  warnings: string[]
}

const CALCULATOR_ID_SET = new Set<string>(CALCULATOR_IDS)

export function isCalculatorId(value: unknown): value is CalculatorId {
  return typeof value === "string" && CALCULATOR_ID_SET.has(value)
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/

export function isIsoDateTimeString(value: unknown): value is string {
  return typeof value === "string" && ISO_DATETIME_REGEX.test(value) && !Number.isNaN(Date.parse(value))
}

export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (year < 1900 || year > 2200) return false
  if (month < 1 || month > 12) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isPrefillSource(value: unknown): value is PrefillSource {
  return (
    typeof value === "string" &&
    ["salary_table", "contract_rule", "regulation_rule", "profile", "last_payslip", "multiple_payslips", "user_confirmation", "calculated"].includes(value)
  )
}

function isPrefillConfidence(value: unknown): value is PrefillConfidence {
  return (
    typeof value === "string" &&
    ["high", "medium", "requires_confirmation"].includes(value)
  )
}

function isPrefillField(
  value: unknown,
  isValue: (v: unknown) => boolean
): value is PrefillField<unknown> {
  if (typeof value !== "object" || value === null) return false
  const f = value as Record<string, unknown>
  return (
    isValue(f.value) &&
    isPrefillSource(f.source) &&
    isPrefillConfidence(f.confidence) &&
    isIsoDateString(f.effectiveAt) &&
    typeof f.editable === "boolean" &&
    (f.ruleVersion === undefined || isString(f.ruleVersion)) &&
    (f.legalReference === undefined || isString(f.legalReference)) &&
    (f.warning === undefined || isString(f.warning))
  )
}

const FIELD_CHECKS: Array<[string, (v: unknown) => boolean]> = [
  ["categoryId", isString],
  ["categoryName", isString],
  ["concepto002", isNumber],
  ["concepto011", isNumber],
  ["concepto020", isNumber],
  ["concepto022", isNumber],
  ["concepto023", isNumber],
  ["concepto050", isNumber],
  ["concepto054", isNumber],
  ["concepto063", isNumber],
  ["workdayHours", isNumber],
  ["seniorityYears", isNumber],
  ["effectiveSeniorityDate", isString],
  ["daysWorkedInAnnualPeriod", isNumber],
]

export function isCalculatorPrefillResponse(value: unknown): value is CalculatorPrefillResponse {
  if (typeof value !== "object" || value === null) return false
  const r = value as Record<string, unknown>

  if (r.schemaVersion !== "1.0") return false
  if (!isCalculatorId(r.calculatorId)) return false
  if (!isIsoDateString(r.targetDate)) return false
  if (!isIsoDateTimeString(r.generatedAt)) return false
  if (typeof r.categoryResolved !== "boolean") return false
  if (!["resolved", "ambiguous", "not_found", "missing_profile"].includes(String(r.categoryResolutionStatus))) {
    return false
  }
  if (!Array.isArray(r.warnings) || !r.warnings.every(isString)) return false
  if (!Array.isArray(r.missingFacts) || !r.missingFacts.every(isString)) return false
  if (typeof r.fields !== "object" || r.fields === null) return false

  const fields = r.fields as Record<string, unknown>
  for (const [key, check] of FIELD_CHECKS) {
    if (fields[key] === undefined) continue
    if (!isPrefillField(fields[key], check)) return false
  }

  return true
}
