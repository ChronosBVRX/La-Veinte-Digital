/**
 * Adaptador puro: mapea un ParsedImssTarjeton a datos de revisión.
 * Separa campos detectados (proposedValues) de campos confirmados (selección
 * del usuario). Sin efectos secundarios.
 */
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { WorkerProfileDraft, WorkerFieldName, EmploymentType, Shift, JornadaHoras } from "@/shared/domain/worker"

const VALID_JORNADAS = new Set<number>([6, 6.5, 8, 12])
const VALID_SHIFTS: readonly string[] = ["matutino", "vespertino", "nocturno", "jornada_acumulada", "mixto"]
const EXACT_EMPLOYMENT: readonly string[] = ["base", "confianza"]

export interface DetectedField {
  field: WorkerFieldName
  label: string
  value: string | null
  confidence?: number
}

export interface PayslipDraftResult {
  draft: WorkerProfileDraft
  detectedFields: DetectedField[]
  requiresConfirmation: WorkerFieldName[]
  warnings: string[]
  extraction: { method: string; confidence?: number; period?: string }
}

export function mapParsedPayslipToWorkerProfileDraft(parsed: ParsedImssTarjeton): PayslipDraftResult {
  const employee = parsed.employee
  const detected: DetectedField[] = []
  const requiresConfirmation: WorkerFieldName[] = []
  const warnings: string[] = []
  const draft: WorkerProfileDraft = { mode: "payslip", identity: {}, situation: {}, confirmedFields: [] }

  if (employee.employeeNumber) {
    detected.push({ field: "matricula", label: "Matrícula", value: employee.employeeNumber })
    draft.identity.matricula = employee.employeeNumber
    draft.confirmedFields.push("matricula")
  }

  if (employee.fullName) {
    warnings.push(`Nombre detectado: ${employee.fullName} (informativo, no se guarda como campo laboral)`)
  }

  const adscripcion = (employee as Record<string, unknown>).assignmentName as string | undefined
    ?? employee.location
  if (adscripcion) {
    detected.push({ field: "adscripcion", label: "Adscripción", value: adscripcion })
    draft.identity.adscripcion = adscripcion
  }

  if (employee.categoryName) {
    detected.push({ field: "categoria", label: "Categoría", value: employee.categoryName, confidence: parsed.extraction.globalConfidence ?? undefined })
    draft.identity.categoria = employee.categoryName
    draft.confirmedFields.push("categoria")
  }

  if (employee.workdayHours && VALID_JORNADAS.has(employee.workdayHours)) {
    detected.push({ field: "workdayHours", label: "Jornada", value: `${employee.workdayHours}h` })
    draft.situation.workdayHours = employee.workdayHours as JornadaHoras
    draft.confirmedFields.push("workdayHours")
  }

  if (employee.seniority?.reconstructedEffectiveDate) {
    detected.push({ field: "effectiveSeniorityDate", label: "Antigüedad (fecha)", value: employee.seniority.reconstructedEffectiveDate })
    draft.situation.effectiveSeniorityDate = employee.seniority.reconstructedEffectiveDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  } else if (employee.entryDate) {
    detected.push({ field: "effectiveSeniorityDate", label: "Antigüedad (fecha ingreso)", value: employee.entryDate })
    draft.situation.effectiveSeniorityDate = employee.entryDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  }

  if (employee.entryDate && !draft.situation.effectiveSeniorityDate) {
    detected.push({ field: "effectiveSeniorityDate", label: "Antigüedad (fecha)", value: employee.entryDate })
    draft.situation.effectiveSeniorityDate = employee.entryDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  }

  const shiftRaw = (employee as Record<string, unknown>).shift as string | undefined
  if (shiftRaw && VALID_SHIFTS.includes(shiftRaw)) {
    detected.push({ field: "shift", label: "Turno", value: shiftRaw })
    draft.situation.shift = shiftRaw as Shift
  }

  if (employee.employmentType) {
    detected.push({ field: "employmentType", label: "Tipo de contratación", value: employee.employmentType })
    if (EXACT_EMPLOYMENT.includes(employee.employmentType)) {
      draft.situation.employmentType = employee.employmentType as EmploymentType
      draft.confirmedFields.push("employmentType")
    } else {
      requiresConfirmation.push("employmentType")
      warnings.push(`Tipo de contratación "${employee.employmentType}" requiere confirmación manual.`)
    }
  }

  return {
    draft,
    detectedFields: detected,
    requiresConfirmation,
    warnings,
    extraction: {
      method: parsed.extraction.method ?? "native_text",
      confidence: parsed.extraction.globalConfidence ?? undefined,
      period: parsed.document.periodRaw || undefined,
    },
  }
}
