/**
 * Adaptadores dominio ↔ persistencia del perfil laboral.
 *
 * Los contratos de dominio (src/shared/domain/worker) NO importan tipos
 * Supabase. Estos adaptadores SÍ pueden importar los tipos generados y son el
 * único puente entre filas SQL y objetos de dominio.
 *
 * Reglas de employment_type legacy (sin inventar equivalencias):
 * - base → base (exacta)
 * - confianza → confianza (exacta)
 * - eventual / confianza_a_estatuto → sin equivalencia canónica; se expone
 *   requiresEmploymentTypeConfirmation: true
 */
import type { Tables } from "@/lib/supabase/types"
import type {
  ConsentPurpose,
  ConsentRecord,
  ConsentSource,
  WorkerDataEvent,
  WorkerEventPriority,
  WorkerEventType,
  WorkerFieldName,
  WorkerFieldSource,
  WorkerIdentity,
  WorkerOnboardingState,
  WorkerProfile,
  WorkerProfileMode,
} from "@/shared/domain/worker"

type WorkerPreferencesRow = Tables<"worker_preferences">
type PayrollContextsRow = Tables<"payroll_contexts">
type WorkerConsentsRow = Tables<"worker_consents">
type WorkerDataEventsRow = Tables<"worker_data_events">

export interface WorkerPreferencesView {
  onboardingState: WorkerOnboardingState
  preferredWorkerMode: WorkerProfileMode | null
  updatedAt: string
}

const VALID_ONBOARDING: readonly string[] = ["unconfigured", "basic", "configured"]
const VALID_MODES: readonly string[] = ["manual", "payslip"]
const VALID_SOURCES: readonly WorkerFieldSource[] = [
  "manual",
  "payslip_confirmed",
  "calculated",
  "inferred",
]

function asWorkerOnboardingState(value: string): WorkerOnboardingState {
  if (!VALID_ONBOARDING.includes(value)) {
    throw new Error(`worker_preferences.onboarding_state inesperado: ${value}`)
  }
  return value as WorkerOnboardingState
}

function asWorkerProfileMode(value: string | null): WorkerProfileMode | null {
  if (value === null) return null
  if (!VALID_MODES.includes(value)) {
    throw new Error(`worker_preferences.preferred_worker_mode inesperado: ${value}`)
  }
  return value as WorkerProfileMode
}

function asSource(value: string | null | undefined, field: WorkerFieldName): WorkerFieldSource | null {
  if (value === null || value === undefined) return null
  if (!VALID_SOURCES.includes(value as WorkerFieldSource)) {
    throw new Error(`source_${field} inesperado: ${value}`)
  }
  return value as WorkerFieldSource
}

function asWorkdayHours(value: number | null): 6 | 6.5 | 8 | 12 | null {
  if (value === null) return null
  if (value === 6 || value === 6.5 || value === 8 || value === 12) return value
  return null
}

/**
 * employment_type canónico del dominio. Los valores sin equivalencia canónica
 * (eventual, confianza_a_estatuto) devuelven null y activan
 * requiresEmploymentTypeConfirmation.
 */
export function mapEmploymentType(value: string | null): {
  employmentType: "base" | "confianza" | null
  requiresEmploymentTypeConfirmation: boolean
} {
  if (value === null) return { employmentType: null, requiresEmploymentTypeConfirmation: false }
  if (value === "base" || value === "confianza") {
    return { employmentType: value, requiresEmploymentTypeConfirmation: false }
  }
  // eventual, confianza_a_estatuto, u otros legacy: sin equivalencia canónica.
  return { employmentType: null, requiresEmploymentTypeConfirmation: true }
}

export function mapWorkerPreferencesRow(row: WorkerPreferencesRow): WorkerPreferencesView {
  return {
    onboardingState: asWorkerOnboardingState(row.onboarding_state),
    preferredWorkerMode: asWorkerProfileMode(row.preferred_worker_mode),
    updatedAt: row.updated_at,
  }
}

/** Mapea payroll_contexts a un WorkerProfile (más preferencias + señal de empleo). */
export function mapPayrollContextToWorkerProfile(
  row: PayrollContextsRow,
  prefs: WorkerPreferencesView,
): WorkerProfile & { requiresEmploymentTypeConfirmation: boolean } {
  const identity: WorkerIdentity = {
    matricula: row.matricula,
    adscripcion: row.adscripcion,
    categoria: row.category_name,
  }

  const employment = mapEmploymentType(row.employment_type)

  const sources: Partial<Record<WorkerFieldName, WorkerFieldSource>> = {}
  const rawSources: Record<string, string | null> = {
    matricula: row.source_matricula,
    adscripcion: row.source_adscripcion,
    categoria: row.source_category_name,
    workdayHours: row.source_workday_hours,
    shift: row.source_shift,
    employmentType: row.source_employment_type,
    effectiveSeniorityDate: row.source_effective_seniority_date,
  }
  for (const key of Object.keys(rawSources) as WorkerFieldName[]) {
    const src = asSource(rawSources[key], key)
    if (src !== null) sources[key] = src
  }

  return {
    userId: row.user_id,
    mode: prefs.preferredWorkerMode ?? "manual",
    identity,
    situation: {
      workdayHours: asWorkdayHours(row.workday_hours),
      shift: row.shift as WorkerProfile["situation"]["shift"] | null | undefined,
      employmentType: employment.employmentType,
      effectiveSeniorityDate: row.effective_seniority_date ?? null,
    },
    sources,
    updatedAt: row.updated_at,
    requiresEmploymentTypeConfirmation: employment.requiresEmploymentTypeConfirmation,
  }
}

const VALID_PURPOSES: readonly string[] = ["use_worker_data", "store_tarjeton"]
const VALID_SOURCES_CONSENT: readonly ConsentSource[] = [
  "onboarding",
  "worker_center",
  "tarjeton",
  "settings",
]

export function mapWorkerConsentRow(row: WorkerConsentsRow): ConsentRecord {
  if (!VALID_PURPOSES.includes(row.purpose)) {
    throw new Error(`worker_consents.purpose inesperado: ${row.purpose}`)
  }
  if (!VALID_SOURCES_CONSENT.includes(row.accepted_source as ConsentSource)) {
    throw new Error(`worker_consents.accepted_source inesperado: ${row.accepted_source}`)
  }
  return {
    userId: row.user_id,
    purpose: row.purpose as ConsentPurpose,
    version: row.version,
    acceptedAt: row.accepted_at,
    acceptedSource: row.accepted_source as ConsentSource,
    revokedAt: row.revoked_at ?? null,
  }
}

const VALID_EVENT_TYPES: readonly string[] = [
  "profile_created",
  "mode_changed",
  "tarjeton_imported",
  "field_updated",
  "consent_granted",
  "consent_revoked",
  "data_deleted",
]
const VALID_PRIORITIES: readonly string[] = ["info", "important", "critical"]

export function mapWorkerEventRow(row: WorkerDataEventsRow): WorkerDataEvent {
  if (!VALID_EVENT_TYPES.includes(row.event_type)) {
    throw new Error(`worker_data_events.event_type inesperado: ${row.event_type}`)
  }
  if (!VALID_PRIORITIES.includes(row.priority)) {
    throw new Error(`worker_data_events.priority inesperado: ${row.priority}`)
  }
  return {
    id: String(row.id),
    userId: row.user_id,
    eventType: row.event_type as WorkerEventType,
    priority: row.priority as WorkerEventPriority,
    metadata: row.metadata as WorkerDataEvent["metadata"],
    createdAt: row.created_at,
  }
}
