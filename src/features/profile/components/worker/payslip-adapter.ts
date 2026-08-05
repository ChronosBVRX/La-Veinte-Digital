/**
 * Adaptador puro: mapea un ParsedImssTarjeton a un WorkerProfileDraft para
 * revisión y confirmación por el trabajador. Sin efectos secundarios.
 */
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { WorkerProfileDraft, WorkerFieldName, EmploymentType, Shift, JornadaHoras } from "@/shared/domain/worker"

const VALID_JORNADAS = new Set<number>([6, 6.5, 8, 12])
const VALID_SHIFTS: readonly string[] = ["matutino", "vespertino", "nocturno", "jornada_acumulada", "mixto"]
const EXACT_EMPLOYMENT: readonly string[] = ["base", "confianza"]

export interface PayslipDraftResult {
  draft: WorkerProfileDraft
  /** Campos detectados pero con valor que requiere confirmación manual. */
  requiresConfirmation: WorkerFieldName[]
  /** Mensajes informativos para la UI (no errores). */
  notes: string[]
}

/**
 * Mapea datos extraídos del tarjetón a un WorkerProfileDraft.
 * Los campos se marcan como detectados pero NO confirmados (el usuario debe
 * revisar y marcar la casilla de consentimiento antes de que cualquiera se
 * marque como payslip_confirmed).
 *
 * No inventa datos. La fuente se asigna como payslip_confirmed solo después
 * de que el usuario confirme.
 */
export function mapParsedPayslipToWorkerProfileDraft(parsed: ParsedImssTarjeton): PayslipDraftResult {
  const employee = parsed.employee
  const draft: WorkerProfileDraft = { mode: "payslip", identity: {}, situation: {}, confirmedFields: [] }
  const requiresConfirmation: WorkerFieldName[] = []
  const notes: string[] = []

  // Matrícula
  if (employee.employeeNumber) {
    draft.identity.matricula = employee.employeeNumber
    draft.confirmedFields.push("matricula")
  }

  // Nombre (informativo, no parte del perfil laboral)
  if (employee.fullName) {
    notes.push(`Nombre detectado: ${employee.fullName}`)
  }

  // Adscripción (vía location/assignmentName)
  const adscripcion = (employee as Record<string, unknown>).assignmentName as string | undefined
    ?? employee.location
  if (adscripcion) {
    draft.identity.adscripcion = adscripcion
    // Adscripción es opcional; se marca como detectada pero no fuerza confirmación.
  }

  // Categoría
  if (employee.categoryName) {
    draft.identity.categoria = employee.categoryName
    draft.confirmedFields.push("categoria")
  }

  // Jornada
  if (employee.workdayHours && VALID_JORNADAS.has(employee.workdayHours)) {
    draft.situation.workdayHours = employee.workdayHours as JornadaHoras
    draft.confirmedFields.push("workdayHours")
  }

  // Turno (no estándar en tarjetón; se infiere de manera conservadora)
  const shiftRaw = (employee as Record<string, unknown>).shift as string | undefined
  if (shiftRaw && VALID_SHIFTS.includes(shiftRaw)) {
    draft.situation.shift = shiftRaw as Shift
  }

  // Tipo de contratación
  if (employee.employmentType) {
    if (EXACT_EMPLOYMENT.includes(employee.employmentType)) {
      draft.situation.employmentType = employee.employmentType as EmploymentType
      draft.confirmedFields.push("employmentType")
    } else {
      // eventual, confianza_a_estatuto, etc. → requiere confirmación manual.
      requiresConfirmation.push("employmentType")
      notes.push(`Tipo de contratación "${employee.employmentType}" requiere confirmación manual.`)
    }
  }

  // Antigüedad efectiva
  if (employee.seniority?.reconstructedEffectiveDate) {
    draft.situation.effectiveSeniorityDate = employee.seniority.reconstructedEffectiveDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  } else if (employee.entryDate) {
    draft.situation.effectiveSeniorityDate = employee.entryDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  }

  // Fecha de ingreso (si existe pero no hay antigüedad efectiva, se usa como fallback)
  if (employee.entryDate && !draft.situation.effectiveSeniorityDate) {
    draft.situation.effectiveSeniorityDate = employee.entryDate
    draft.confirmedFields.push("effectiveSeniorityDate")
  }

  return { draft, requiresConfirmation, notes }
}
