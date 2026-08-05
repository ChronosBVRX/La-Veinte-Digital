/**
 * Construye un ConfirmedWorkerProfileUpdate filtrado a partir del draft
 * confirmado por el usuario. Solo incluye campos seleccionados.
 *
 * Reglas:
 * - identity/situation/sources solo incluyen campos en confirmedFields.
 * - Nunca incluye File, PDF, base64, texto extraído, parsed completo, userId,
 *   accepted_source, accepted_at, event_type, priority.
 * - Metadata de extracción solo si existe (no inventa valores).
 */
import type { ConfirmedWorkerProfileUpdate, WorkerFieldName, WorkerProfileDraft, WorkerProfileMode } from "@/shared/domain/worker"

const IDENTITY_FIELDS = new Set<WorkerFieldName>(["matricula", "adscripcion", "categoria"])
const SITUATION_FIELDS = new Set<WorkerFieldName>(["workdayHours", "shift", "employmentType", "effectiveSeniorityDate"])

export function buildConfirmedPayslipProfileUpdate(
  draft: WorkerProfileDraft,
  extractionMeta: { method: string; confidence?: number; period?: string },
  consentVersion: string,
): ConfirmedWorkerProfileUpdate {
  const source: WorkerProfileMode = draft.mode

  const identity: WorkerProfileDraft["identity"] = {}
  const situation: WorkerProfileDraft["situation"] = {}
  const sources: Record<string, string> = {}

  for (const f of draft.confirmedFields) {
    if (IDENTITY_FIELDS.has(f)) {
      identity[f as keyof typeof identity] = draft.identity[f as keyof typeof draft.identity] ?? null
    }
    if (SITUATION_FIELDS.has(f)) {
      const val = draft.situation[f as keyof typeof draft.situation]
      ;(situation as Record<string, unknown>)[f] = val ?? null
    }
    sources[f] = "payslip_confirmed"
  }

  return {
    mode: source,
    sourceOfRequest: "payslip",
    identity,
    situation,
    sources: sources as ConfirmedWorkerProfileUpdate["sources"],
    consentRef: { purpose: "store_tarjeton", version: consentVersion },
  }
}

/** Valida campos editados según tipo. Devuelve mensaje de error o null si es válido. */
export function validateFieldEdit(field: WorkerFieldName, value: string): string | null {
  const v = value.trim()
  if (!v) return null // campos opcionales pueden quedar vacíos

  switch (field) {
    case "matricula":
      if (v.length > 32) return "Máximo 32 caracteres."
      if (!/^[A-Za-z0-9]{5,12}$/.test(v) && v.length >= 5) return "Formato inválido: usa solo letras y números (5-12 caracteres)."
      return null
    case "categoria":
    case "adscripcion":
      if (v.length > 200) return "Máximo 200 caracteres."
      return null
    case "workdayHours":
      if (!/^(6|6\.5|8|12)h?$/.test(v)) return "Jornada inválida (6, 6.5, 8 o 12)."
      return null
    case "effectiveSeniorityDate":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Formato de fecha inválido (AAAA-MM-DD)."
      return null
    case "shift":
      if (!["matutino", "vespertino", "nocturno", "jornada_acumulada", "mixto"].includes(v)) return "Turno inválido."
      return null
    case "employmentType":
      if (!["base", "confianza", "sustituto", "interino", "obra_determinada", "otro"].includes(v)) return "Tipo de contratación no permitido."
      return null
    default:
      return null
  }
}
