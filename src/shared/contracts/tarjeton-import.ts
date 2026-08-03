/**
 * Contrato compartido del importador de tarjetones IMSS.
 *
 * Este archivo NO contiene lógica de negocio: solo tipos y validadores
 * manuales (patrón de `calculator-prefill.ts`). La lógica vive en
 * `features/tarjeton` (extracción/parsing en el navegador) y en el endpoint
 * de confirmación; el motor de nómina consume el resultado vía Supabase.
 *
 * Nota de privacidad: este contrato NO admite RFC, CURP, NSS, cuenta
 * bancaria, folio fiscal, códigos QR ni sellos. El endpoint descarta
 * cualquier clave ajena al contrato.
 */

export type TarjetonExtractionMethod = "native_text" | "ocr" | "hybrid"

export interface PositionedPdfText {
  text: string
  /** Página 1-based. */
  page: number
  /** Coordenada X (origen arriba-izquierda, unidades PDF escala 1). */
  x: number
  /** Coordenada Y (origen arriba-izquierda, unidades PDF escala 1). */
  y: number
  width: number
  height: number
  /** 0..1 — 1 cuando el texto es nativo del PDF. */
  confidence: number
  method: TarjetonExtractionMethod
}

export interface ExtractedTarjetonField<T> {
  value: T | null
  /** Texto crudo del que se derivó el valor (nunca datos sensibles). */
  rawValue: string | null
  page: number
  confidence: number
  method: TarjetonExtractionMethod
  requiresReview: boolean
}

export interface TarjetonSeniority {
  raw: string
  years: number
  /** Quincenas tal como aparecen en el tarjetón (NO se convierten a meses). */
  fortnights: number
  days: number
  /** Fecha de referencia usada para reconstruir la fecha efectiva. */
  referenceDate: string
  /** Fecha efectiva reconstruida (fin de periodo − años − qnas×15 − días). */
  reconstructedEffectiveDate?: string
}

export interface TarjetonConceptLine {
  lineIndex: number
  code: string
  description: string
  amount: number
  kind: "earning" | "deduction"
  confidence: number
  confirmedByUser: boolean
}

export interface TarjetonObservation {
  lineIndex: number
  conceptCode: string
  amount?: number
  duePeriod?: string
  units?: number
  controlNumber?: string
  initialCharge?: number
  notes?: string
}

export interface ParsedImssTarjeton {
  schemaVersion: "1.0"

  document: {
    type: "imss_payroll_receipt"
    pageCount: number
    periodRaw: string
    year?: number
    month?: number
    half?: 1 | 2
    folio?: string
    /** Hash del folio fiscal (se guarda la huella, no el valor). */
    fiscalFolioHash?: string
    certificationDate?: string
  }

  employee: {
    employeeNumber?: string
    fullName?: string
    employmentType?: string
    location?: string
    organizationalCode?: string
    categoryCode?: string
    categoryName?: string
    workdayHours?: number
    plaza?: string
    entryDate?: string
    seniority?: TarjetonSeniority
  }

  attendance: {
    delays?: number
    exitPasses?: number
    absences?: number
    noDelayDays?: number
    attendanceScore?: number
    incidentFortnight?: number
    generalIllnessLeave?: number
    occupationalRiskLeave?: number
    maternityLeave?: number
    license140Bis?: number
    paidLicenses?: number
    unpaidLicenses?: number
    commissions?: number
    trainingCommissions?: number
    scholarshipWithPay?: number
    scholarshipWithoutPay?: number
    concept033Days?: number
  }

  vacations: {
    enjoyedDays?: number
    daysInYear?: number
    twentyYearsOrMoreDays?: number
    expiredPeriods?: number
    continuityMark?: number
    periodNumberToEnjoy?: number
    firstPeriodStartRaw?: string
    secondPeriodStartRaw?: string
    accumulatedRetirementDays?: number
  }

  payroll: {
    earnings: TarjetonConceptLine[]
    deductions: TarjetonConceptLine[]
    observations: TarjetonObservation[]
    totalEarnings?: number
    totalDeductions?: number
    netPay?: number
    daysWorkedInYear?: number
    daysPaidInFortnight?: number
    integratedMonthlySalary?: number
    creditCapacity?: number
  }

  extraction: {
    method: TarjetonExtractionMethod
    globalConfidence: number
    /** Evidencia propia de los campos críticos; no hereda la confianza global. */
    fieldConfidences?: Partial<Record<
      "employeeNumber" | "fullName" | "categoryCode" | "categoryName" | "entryDate" | "seniority",
      number
    >>
    warnings: string[]
    validations: {
      templateDetected: boolean
      earningsTotalMatches: boolean | null
      deductionsTotalMatches: boolean | null
      netPayMatches: boolean | null
      employeeMatchesProfile: boolean | null
      categoryResolved: boolean | null
    }
  }
}

/** Qué campos del perfil autoriza aplicar el trabajador al confirmar. */
export interface TarjetonProfileUpdateRequest {
  fullName?: boolean
  matricula?: boolean
  categoria?: boolean
  antiguedad?: boolean
}

/**
 * Cuerpo del POST /api/tarjeton/confirm.
 *
 * Solo llega el resultado estructurado y confirmado por el usuario;
 * el PDF original nunca se envía al servidor.
 */
export interface ConfirmTarjetonRequest {
  schemaVersion: "1.0"
  /** SHA-256 del PDF original (huella para detectar duplicados). */
  sourceHash: string
  parsed: ParsedImssTarjeton
  profileUpdates: TarjetonProfileUpdateRequest
  /** true solo si el trabajador confirmó expresamente una diferencia de totales. */
  acknowledgeTotalDifference: boolean
  /** true solo si el trabajador autorizó guardar sus datos en el servidor. */
  authorizeServerStorage: boolean
}

export interface ConfirmTarjetonResponse {
  schemaVersion: "1.0"
  id: string
  duplicate: boolean
  profileUpdated: boolean
  payrollContextUpdated: boolean
}

export type ConfirmTarjetonErrorCode =
  | "invalid_payload"
  | "unauthorized"
  | "duplicate"
  | "totals_mismatch"
  | "matricula_mismatch"
  | "limits_exceeded"
  | "template_not_detected"
  | "consent_required"
  | "internal"

export interface ConfirmTarjetonError {
  code: ConfirmTarjetonErrorCode
  message: string
}

/* ------------------------------------------------------------------ *
 * Validadores manuales (sin Zod; siguen el patrón del proyecto)
 * ------------------------------------------------------------------ */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Whitelist estricta: rechaza cualquier clave ajena al contrato. Se aplica
 * recursivamente a cada subobjeto para que datos sensibles (RFC, CURP, NSS,
 * cuentas, QR, sellos) nunca lleguen al servidor aunque se envíen por error.
 */
function hasOnlyKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(object).every((key) => allowed.includes(key))
}

const PARSE_ROOT_KEYS = ["schemaVersion", "document", "employee", "attendance", "vacations", "payroll", "extraction"] as const

const DOCUMENT_KEYS = ["type", "pageCount", "periodRaw", "year", "month", "half", "folio", "fiscalFolioHash", "certificationDate"] as const

const EMPLOYEE_KEYS = [
  "employeeNumber", "fullName", "employmentType", "location", "organizationalCode",
  "categoryCode", "categoryName", "workdayHours",
  "plaza", "entryDate", "seniority",
] as const

const SENIORITY_KEYS = ["raw", "years", "fortnights", "days", "referenceDate", "reconstructedEffectiveDate"] as const

const ATTENDANCE_KEYS = [
  "delays", "exitPasses", "absences", "noDelayDays", "attendanceScore", "incidentFortnight",
  "generalIllnessLeave", "occupationalRiskLeave", "maternityLeave", "license140Bis",
  "paidLicenses", "unpaidLicenses", "commissions", "trainingCommissions",
  "scholarshipWithPay", "scholarshipWithoutPay", "concept033Days",
] as const

const VACATIONS_KEYS = [
  "enjoyedDays", "daysInYear", "twentyYearsOrMoreDays", "expiredPeriods",
  "continuityMark", "periodNumberToEnjoy", "firstPeriodStartRaw",
  "secondPeriodStartRaw", "accumulatedRetirementDays",
] as const

const PAYROLL_KEYS = [
  "earnings", "deductions", "observations", "totalEarnings", "totalDeductions",
  "netPay", "daysWorkedInYear", "daysPaidInFortnight",
  "integratedMonthlySalary", "creditCapacity",
] as const

const EXTRACTION_KEYS = ["method", "globalConfidence", "fieldConfidences", "warnings", "validations"] as const
const FIELD_CONFIDENCE_KEYS = ["employeeNumber", "fullName", "categoryCode", "categoryName", "entryDate", "seniority"] as const

const VALIDATIONS_KEYS = [
  "templateDetected", "earningsTotalMatches", "deductionsTotalMatches",
  "netPayMatches", "employeeMatchesProfile", "categoryResolved",
] as const

const CONCEPT_LINE_KEYS = ["lineIndex", "code", "description", "amount", "kind", "confidence", "confirmedByUser"] as const

const OBSERVATION_KEYS = ["lineIndex", "conceptCode", "amount", "duePeriod", "units", "controlNumber", "initialCharge", "notes"] as const

const PROFILE_UPDATE_KEYS = ["fullName", "matricula", "categoria", "antiguedad"] as const

const REQUEST_KEYS = ["schemaVersion", "sourceHash", "parsed", "profileUpdates", "acknowledgeTotalDifference", "authorizeServerStorage"] as const

const RESPONSE_KEYS = ["schemaVersion", "id", "duplicate", "profileUpdated", "payrollContextUpdated"] as const

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumber(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || isBoolean(value)
}

function isExtractionMethod(value: unknown): value is TarjetonExtractionMethod {
  return value === "native_text" || value === "ocr" || value === "hybrid"
}

export function isPositionedPdfText(value: unknown): value is PositionedPdfText {
  if (!isObject(value)) return false
  return (
    isString(value.text) &&
    isNumber(value.page) && value.page >= 1 &&
    isNumber(value.x) && isNumber(value.y) &&
    isNumber(value.width) && isNumber(value.height) &&
    isNumber(value.confidence) && value.confidence >= 0 && value.confidence <= 1 &&
    isExtractionMethod(value.method)
  )
}

export function isTarjetonConceptLine(value: unknown): value is TarjetonConceptLine {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, CONCEPT_LINE_KEYS)) return false
  return (
    isNumber(value.lineIndex) &&
    isString(value.code) &&
    isString(value.description) &&
    isNumber(value.amount) &&
    (value.kind === "earning" || value.kind === "deduction") &&
    isNumber(value.confidence) &&
    isBoolean(value.confirmedByUser)
  )
}

export function isTarjetonObservation(value: unknown): value is TarjetonObservation {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, OBSERVATION_KEYS)) return false
  return (
    isNumber(value.lineIndex) &&
    isString(value.conceptCode) &&
    isOptionalNumber(value.amount) &&
    isOptionalString(value.duePeriod) &&
    isOptionalNumber(value.units) &&
    isOptionalString(value.controlNumber) &&
    isOptionalNumber(value.initialCharge) &&
    isOptionalString(value.notes)
  )
}

export function isParsedImssTarjeton(value: unknown): value is ParsedImssTarjeton {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, PARSE_ROOT_KEYS)) return false
  if (value.schemaVersion !== "1.0") return false

  const doc = value.document
  if (!isObject(doc)) return false
  if (!hasOnlyKeys(doc, DOCUMENT_KEYS)) return false
  if (doc.type !== "imss_payroll_receipt") return false
  if (!isNumber(doc.pageCount) || doc.pageCount < 1 || doc.pageCount > 4) return false
  if (!isString(doc.periodRaw)) return false
  if (!isOptionalNumber(doc.year) || !isOptionalNumber(doc.month) || !isOptionalNumber(doc.half)) return false
  if (!isOptionalString(doc.folio) || !isOptionalString(doc.certificationDate)) return false
  if (doc.fiscalFolioHash !== undefined && (!isString(doc.fiscalFolioHash) || !/^[a-f0-9]{64}$/i.test(doc.fiscalFolioHash))) return false

  const emp = value.employee
  if (!isObject(emp)) return false
  if (!hasOnlyKeys(emp, EMPLOYEE_KEYS)) return false
  for (const key of ["employeeNumber", "fullName", "employmentType", "location", "organizationalCode", "categoryCode", "categoryName", "plaza", "entryDate"] as const) {
    if (!isOptionalString(emp[key])) return false
  }
  if (!isOptionalNumber(emp.workdayHours)) return false
  if (emp.seniority !== undefined) {
    const s = emp.seniority as Record<string, unknown>
    if (!isObject(s)) return false
    if (!hasOnlyKeys(s, SENIORITY_KEYS)) return false
    if (!isString(s.raw) || !isNumber(s.years) || !isNumber(s.fortnights) || !isNumber(s.days)) return false
    if (!isString(s.referenceDate)) return false
    if (!isOptionalString(s.reconstructedEffectiveDate)) return false
  }

  const att = value.attendance
  if (!isObject(att)) return false
  if (!hasOnlyKeys(att, ATTENDANCE_KEYS)) return false
  for (const key of ATTENDANCE_KEYS) {
    if (!isOptionalNumber(att[key])) return false
  }

  const vac = value.vacations
  if (!isObject(vac)) return false
  if (!hasOnlyKeys(vac, VACATIONS_KEYS)) return false
  for (const key of VACATIONS_KEYS) {
    if (key === "firstPeriodStartRaw" || key === "secondPeriodStartRaw") {
      if (!isOptionalString(vac[key])) return false
    } else if (!isOptionalNumber(vac[key])) return false
  }

  const pay = value.payroll
  if (!isObject(pay)) return false
  if (!hasOnlyKeys(pay, PAYROLL_KEYS)) return false
  if (!Array.isArray(pay.earnings) || !pay.earnings.every(isTarjetonConceptLine)) return false
  if (!Array.isArray(pay.deductions) || !pay.deductions.every(isTarjetonConceptLine)) return false
  if (!Array.isArray(pay.observations) || !pay.observations.every(isTarjetonObservation)) return false
  for (const key of ["totalEarnings", "totalDeductions", "netPay", "daysWorkedInYear", "daysPaidInFortnight", "integratedMonthlySalary", "creditCapacity"] as const) {
    if (!isOptionalNumber(pay[key])) return false
  }

  const ext = value.extraction
  if (!isObject(ext)) return false
  if (!hasOnlyKeys(ext, EXTRACTION_KEYS)) return false
  if (!isExtractionMethod(ext.method)) return false
  if (!isNumber(ext.globalConfidence) || ext.globalConfidence < 0 || ext.globalConfidence > 1) return false
  if (ext.fieldConfidences !== undefined) {
    if (!isObject(ext.fieldConfidences) || !hasOnlyKeys(ext.fieldConfidences, FIELD_CONFIDENCE_KEYS)) return false
    for (const key of FIELD_CONFIDENCE_KEYS) {
      const confidence = ext.fieldConfidences[key]
      if (confidence !== undefined && (!isNumber(confidence) || confidence < 0 || confidence > 1)) return false
    }
  }
  if (!Array.isArray(ext.warnings) || !ext.warnings.every(isString)) return false
  const validations = ext.validations
  if (!isObject(validations)) return false
  if (!hasOnlyKeys(validations, VALIDATIONS_KEYS)) return false
  if (!isBoolean(validations.templateDetected)) return false
  for (const key of ["earningsTotalMatches", "deductionsTotalMatches", "netPayMatches", "employeeMatchesProfile", "categoryResolved"] as const) {
    const v = validations[key]
    if (v !== null && v !== true && v !== false) return false
  }

  return true
}

export function isTarjetonProfileUpdateRequest(value: unknown): value is TarjetonProfileUpdateRequest {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, PROFILE_UPDATE_KEYS)) return false
  for (const key of PROFILE_UPDATE_KEYS) {
    if (!isOptionalBoolean(value[key])) return false
  }
  return true
}

export function isConfirmTarjetonRequest(value: unknown): value is ConfirmTarjetonRequest {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, REQUEST_KEYS)) return false
  if (value.schemaVersion !== "1.0") return false
  if (!isString(value.sourceHash) || !/^[a-f0-9]{64}$/i.test(value.sourceHash)) return false
  if (!isParsedImssTarjeton(value.parsed)) return false
  if (!isTarjetonProfileUpdateRequest(value.profileUpdates)) return false
  if (!isBoolean(value.acknowledgeTotalDifference)) return false
  if (!isBoolean(value.authorizeServerStorage)) return false
  return true
}

export function isConfirmTarjetonResponse(value: unknown): value is ConfirmTarjetonResponse {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, RESPONSE_KEYS)) return false
  return (
    value.schemaVersion === "1.0" &&
    isString(value.id) &&
    isBoolean(value.duplicate) &&
    isBoolean(value.profileUpdated) &&
    isBoolean(value.payrollContextUpdated)
  )
}
