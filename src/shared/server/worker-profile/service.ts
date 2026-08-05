import "server-only"

/**
 * WorkerProfileService — servicio central de escritura/lectura del perfil
 * laboral. Capa servidor.
 *
 * Reglas:
 * - Funciona únicamente en servidor para escrituras.
 * - Obtiene la sesión de auth (nunca acepta userId del cliente).
 * - Escribe EXCLUSIVAMENTE vía RPC de dominio; nunca INSERT/UPDATE/DELETE
 *   directo sobre worker_preferences, worker_consents, worker_data_events ni
 *   columnas nuevas de payroll_contexts.
 * - Usa SELECT propio para lectura.
 * - Mapea filas SQL a contratos de dominio (adapters.ts).
 * - No expone tipos generados de Supabase fuera del adaptador.
 * - No devuelve errores PostgreSQL completos a la UI; conserva la causa
 *   técnica para logging.
 * - No usa service_role ni credenciales administrativas.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import {
  calculateProfileQuality,
  FIELD_REQUIREMENTS,
  type ConfirmedWorkerProfileUpdate,
  type ConsentPurpose,
  type FieldRequirement,
  type ProfileQuality,
  type WorkerDataEvent,
  type WorkerFieldName,
  type WorkerFieldSource,
  type WorkerProfile,
  type WorkerProfileMode,
} from "@/shared/domain/worker"
import {
  mapPayrollContextToWorkerProfile,
  mapWorkerEventRow,
  mapWorkerPreferencesRow,
  type WorkerPreferencesView,
} from "./adapters"
import {
  WorkerProfileConsentRequiredError,
  WorkerProfileError,
  WorkerProfilePersistenceError,
  WorkerProfileTransitionError,
  WorkerProfileUnauthorizedError,
  WorkerProfileUnavailableError,
  WorkerProfileValidationError,
} from "./errors"

export interface WorkerProfileServiceDeps {
  client?: SupabaseClient<Database>
}

export type WorkerProfileState =
  | { state: "unconfigured" }
  | { state: "basic" }
  | { state: "configured"; mode: WorkerProfileMode; profile: WorkerProfile }

export interface EffectiveConsentView {
  purpose: ConsentPurpose
  version: string
  acceptedAt: string
  acceptedSource: string
}

const VALID_MANUAL_FIELDS: readonly WorkerFieldName[] = [
  "matricula",
  "adscripcion",
  "categoria",
  "workdayHours",
  "shift",
  "employmentType",
  "effectiveSeniorityDate",
]

const VALID_SOURCES: readonly WorkerFieldSource[] = [
  "manual",
  "payslip_confirmed",
  "calculated",
  "inferred",
]

const VALID_SHIFTS: readonly string[] = [
  "matutino",
  "vespertino",
  "nocturno",
  "jornada_acumulada",
  "mixto",
]

const VALID_EMPLOYMENT_TYPES: readonly string[] = [
  "base",
  "confianza",
  "eventual",
  "confianza_a_estatuto",
  "sustituto",
  "interino",
  "obra_determinada",
  "otro",
]

const MAX_TEXT_LENGTH = 200
const MAX_MATRICULA_LENGTH = 32
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

/**
 * Mapea el mensaje crudo de error de una RPC a un error funcional.
 * Nunca expone SQL, UUID, nombres de policies ni detalles de RLS.
 */
export function mapRpcError(message: string, fallback: string): WorkerProfileError {
  const normalized = message.toLowerCase()
  if (normalized.includes("unauthorized") || normalized.includes("unauthenticated")) {
    return new WorkerProfileUnauthorizedError()
  }
  if (normalized.includes("consent_required")) {
    return new WorkerProfileConsentRequiredError()
  }
  if (normalized.includes("not allowed") || normalized.includes("invalid")
      || normalized.includes("too long") || normalized.includes("nested object")) {
    return new WorkerProfileValidationError("La información enviada no es válida.", message)
  }
  if (normalized.includes("transition") || normalized.includes("mode")
      || normalized.includes("profile not configured") || normalized.includes("not configured")) {
    return new WorkerProfileTransitionError("La operación no está permitida en tu estado actual.", message)
  }
  return new WorkerProfilePersistenceError(fallback, message)
}

/** Detecta el error de "relación no existe" (migración no aplicada). */
function isMissingRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("does not exist")
      || message.toLowerCase().includes("relation") && message.toLowerCase().includes("not exist")
}

export class WorkerProfileService {
  private readonly client: SupabaseClient<Database>

  constructor(deps: WorkerProfileServiceDeps = {}) {
    this.client = deps.client ?? (createClient() as unknown as SupabaseClient<Database>)
  }

  /** Obtiene el usuario autenticado desde la sesión del servidor. */
  private async getUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser()
    if (error || !data.user) {
      throw new WorkerProfileUnauthorizedError(error ?? undefined)
    }
    return data.user.id
  }

  /** Lee worker_preferences (SELECT propio) o lanza Unavailable si no existe la tabla. */
  async getWorkerPreferences(): Promise<WorkerPreferencesView> {
    const userId = await this.getUserId()
    const { data, error } = await this.client
      .from("worker_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      if (isMissingRelationError(error)) {
        throw new WorkerProfileUnavailableError(error)
      }
      throw new WorkerProfilePersistenceError("No se pudieron leer tus preferencias.", error)
    }
    if (!data) {
      throw new WorkerProfileUnavailableError(
        "Sin fila en worker_preferences: el backfill o la RPC de onboarding aún no ha creado la preferencia.",
      )
    }
    return mapWorkerPreferencesRow(data)
  }

  /**
   * Estado explícito del perfil: unconfigured | basic | configured/manual |
   * configured/payslip. Combina worker_preferences + payroll_contexts.
   */
  async getCurrentProfile(): Promise<WorkerProfileState> {
    const userId = await this.getUserId()
    const prefs = await this.getWorkerPreferences()

    if (prefs.onboardingState === "unconfigured") return { state: "unconfigured" }
    if (prefs.onboardingState === "basic") return { state: "basic" }

    const { data, error } = await this.client
      .from("payroll_contexts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) {
      throw new WorkerProfilePersistenceError("No se pudo leer tu perfil laboral.", error)
    }
    if (!data) {
      // configured sin payroll_contexts: estado incoherente; se reporta como
      // transición pendiente (no se oculta el error).
      throw new WorkerProfileUnavailableError(
        "Estado configured sin payroll_contexts: revisa el backfill o la RPC de confirmación.",
      )
    }

    const profile = mapPayrollContextToWorkerProfile(data, prefs)
    return { state: "configured", mode: prefs.preferredWorkerMode ?? "manual", profile }
  }

  /** choose_basic_mode() — unconfigured|configured → basic (sin perfil laboral). */
  async chooseBasicMode(): Promise<void> {
    await this.getUserId()
    const { error } = await this.client.rpc("choose_basic_mode")
    if (error) throw mapRpcError(error.message, "No se pudo activar el modo básico.")
  }

  /**
   * Valida un ConfirmedWorkerProfileUpdate antes de llamar a la RPC.
   * La validación cliente no sustituye la validación SQL; ambas coexisten.
   */
  validateConfirmedUpdate(update: ConfirmedWorkerProfileUpdate): void {
    if (!update || typeof update !== "object") {
      throw new WorkerProfileValidationError("Actualización de perfil requerida.")
    }
    if (update.mode !== "manual" && update.mode !== "payslip") {
      throw new WorkerProfileValidationError("Modo de perfil inválido.")
    }
    if (update.sourceOfRequest !== "manual" && update.sourceOfRequest !== "payslip") {
      throw new WorkerProfileValidationError("Origen de la solicitud inválido.")
    }
    if (update.consentRef && !update.consentRef.version?.trim()) {
      throw new WorkerProfileValidationError("Versión de consentimiento requerida.")
    }

    const fieldsToValidate: Array<{ name: WorkerFieldName; value: unknown }> = []
    if (update.identity) {
      for (const [k, v] of Object.entries(update.identity)) {
        fieldsToValidate.push({ name: k as WorkerFieldName, value: v })
      }
    }
    if (update.situation) {
      for (const [k, v] of Object.entries(update.situation)) {
        fieldsToValidate.push({ name: k as WorkerFieldName, value: v })
      }
    }

    for (const { name, value } of fieldsToValidate) {
      if (!VALID_MANUAL_FIELDS.includes(name)) {
        throw new WorkerProfileValidationError(`Campo no permitido: ${name}`)
      }
      if (value !== null && typeof value === "object") {
        throw new WorkerProfileValidationError(`Campo anidado no permitido: ${name}`)
      }
    }

    // Validar sources.
    for (const [k, v] of Object.entries(update.sources ?? {})) {
      if (!VALID_MANUAL_FIELDS.includes(k as WorkerFieldName)) {
        throw new WorkerProfileValidationError(`Fuente no permitida: ${k}`)
      }
      if (!VALID_SOURCES.includes(v as WorkerFieldSource)) {
        throw new WorkerProfileValidationError(`Fuente inválida para ${k}`)
      }
    }

    // Longitudes.
    const matricula = update.identity?.matricula
    if (matricula && matricula.length > MAX_MATRICULA_LENGTH) {
      throw new WorkerProfileValidationError("Matrícula demasiado larga.")
    }
    for (const field of ["adscripcion", "categoria"] as const) {
      const value = update.identity?.[field]
      if (value && value.length > MAX_TEXT_LENGTH) {
        throw new WorkerProfileValidationError("Valor demasiado largo.")
      }
    }

    // Enums.
    const shift = update.situation?.shift
    if (shift && !VALID_SHIFTS.includes(shift)) {
      throw new WorkerProfileValidationError("Turno inválido.")
    }
    const employmentType = update.situation?.employmentType
    if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
      throw new WorkerProfileValidationError("Tipo de contratación inválido.")
    }
    const workdayHours = update.situation?.workdayHours
    if (workdayHours !== undefined && workdayHours !== null && ![6, 6.5, 8, 12].includes(workdayHours)) {
      throw new WorkerProfileValidationError("Jornada inválida.")
    }

    // Fecha.
    const seniorityDate = update.situation?.effectiveSeniorityDate
    if (seniorityDate && !DATE_RE.test(seniorityDate)) {
      throw new WorkerProfileValidationError("Fecha de antigüedad inválida.")
    }
  }

  /** confirm_manual_worker_profile(...) — captura manual confirmada. */
  async confirmManualProfile(update: ConfirmedWorkerProfileUpdate): Promise<void> {
    const userId = await this.getUserId()
    this.validateConfirmedUpdate(update)
    if (update.mode !== "manual") {
      throw new WorkerProfileValidationError("Esta operación es para el modo manual.")
    }
    const consentVersion = update.consentRef?.version?.trim()
    if (!consentVersion) {
      throw new WorkerProfileValidationError("Versión de consentimiento requerida.")
    }

    const identity = {
      matricula: update.identity?.matricula ?? null,
      adscripcion: update.identity?.adscripcion ?? null,
      categoria: update.identity?.categoria ?? null,
    }
    const situation = {
      workday_hours: update.situation?.workdayHours ?? null,
      shift: update.situation?.shift ?? null,
      employment_type: update.situation?.employmentType ?? null,
      effective_seniority_date: update.situation?.effectiveSeniorityDate ?? null,
    }
    // sources: solo incluir claves con fuente definida (la RPC exige string,
    // no null). Los campos sin fuente se omiten.
    const sources: Record<string, string> = {}
    const sourceMap: Record<string, WorkerFieldSource | null | undefined> = {
      matricula: update.sources?.matricula,
      adscripcion: update.sources?.adscripcion,
      categoria: update.sources?.categoria,
      workday_hours: update.sources?.workdayHours,
      shift: update.sources?.shift,
      employment_type: update.sources?.employmentType,
      effective_seniority_date: update.sources?.effectiveSeniorityDate,
    }
    for (const [key, value] of Object.entries(sourceMap)) {
      if (value) sources[key] = value
    }

    const { error } = await this.client.rpc("confirm_manual_worker_profile", {
      p_identity: identity,
      p_situation: situation,
      p_sources: sources,
      p_consent_version: consentVersion,
    })
    if (error) throw mapRpcError(error.message, "No se pudo guardar tu perfil laboral.")
    void userId
  }

  /** confirm_payslip_worker_profile(...) — update confirmado desde tarjetón. */
  async confirmPayslipProfile(update: ConfirmedWorkerProfileUpdate): Promise<void> {
    const userId = await this.getUserId()
    this.validateConfirmedUpdate(update)
    if (update.mode !== "payslip") {
      throw new WorkerProfileValidationError("Esta operación es para el modo tarjetón.")
    }
    const consentVersion = update.consentRef?.version?.trim()
    if (!consentVersion) {
      throw new WorkerProfileValidationError("Versión de consentimiento requerida.")
    }

    const profileUpdates = {
      categoria: update.sources?.categoria ? true : false,
      antiguedad: update.sources?.effectiveSeniorityDate ? true : false,
      category_name: update.identity?.categoria ?? null,
      effective_seniority_date: update.situation?.effectiveSeniorityDate ?? null,
    }

    const { error } = await this.client.rpc("confirm_payslip_worker_profile", {
      p_profile_updates: profileUpdates,
      p_consent_version: consentVersion,
      p_extraction_method: undefined,
      p_confidence: undefined,
      p_period: undefined,
    })
    if (error) throw mapRpcError(error.message, "No se pudo guardar tu perfil laboral.")
    void userId
  }

  /** change_worker_profile_mode(mode) — manual ↔ payslip. */
  async changeWorkerProfileMode(mode: WorkerProfileMode): Promise<void> {
    await this.getUserId()
    if (mode !== "manual" && mode !== "payslip") {
      throw new WorkerProfileValidationError("Modo inválido.")
    }
    const { error } = await this.client.rpc("change_worker_profile_mode", { p_new_mode: mode })
    if (error) throw mapRpcError(error.message, "No se pudo cambiar el modo del perfil.")
  }

  /** delete_worker_data() — borrado laboral completo; conserva cuenta y basic. */
  async deleteWorkerData(): Promise<void> {
    await this.getUserId()
    const { error } = await this.client.rpc("delete_worker_data")
    if (error) throw mapRpcError(error.message, "No se pudieron borrar tus datos laborales.")
  }

  /** grant_worker_consent(purpose, version) — nueva fila de aceptación. */
  async grantConsent(purpose: ConsentPurpose, version: string): Promise<void> {
    await this.getUserId()
    if (purpose !== "use_worker_data" && purpose !== "store_tarjeton") {
      throw new WorkerProfileValidationError("Finalidad de consentimiento inválida.")
    }
    if (!version?.trim()) {
      throw new WorkerProfileValidationError("Versión de consentimiento requerida.")
    }
    const { error } = await this.client.rpc("grant_worker_consent", {
      p_purpose: purpose,
      p_version: version.trim(),
    })
    if (error) throw mapRpcError(error.message, "No se pudo registrar el consentimiento.")
  }

  /** revoke_worker_consent(purpose) — revoca el consentimiento vigente. */
  async revokeConsent(purpose: ConsentPurpose): Promise<void> {
    await this.getUserId()
    if (purpose !== "use_worker_data" && purpose !== "store_tarjeton") {
      throw new WorkerProfileValidationError("Finalidad de consentimiento inválida.")
    }
    const { error } = await this.client.rpc("revoke_worker_consent", { p_purpose: purpose })
    if (error) throw mapRpcError(error.message, "No se pudo revocar el consentimiento.")
  }

  /** get_effective_consent(purpose) — devuelve null si no hay consentimiento vigente. */
  async getEffectiveConsent(purpose: ConsentPurpose): Promise<EffectiveConsentView | null> {
    await this.getUserId()
    if (purpose !== "use_worker_data" && purpose !== "store_tarjeton") {
      throw new WorkerProfileValidationError("Finalidad de consentimiento inválida.")
    }
    const { data, error } = await this.client.rpc("get_effective_consent", { p_purpose: purpose })
    if (error) throw mapRpcError(error.message, "No se pudo consultar el consentimiento.")
    if (!data) return null
    const view = data as Record<string, unknown>
    return {
      purpose: view.purpose as ConsentPurpose,
      version: String(view.version ?? ""),
      acceptedAt: String(view.accepted_at ?? ""),
      acceptedSource: String(view.accepted_source ?? ""),
    }
  }

  /** listWorkerEvents(limit) — solo SELECT propio, orden descendente. */
  async listWorkerEvents(limit = 50): Promise<WorkerDataEvent[]> {
    const userId = await this.getUserId()
    const safeLimit = Math.max(1, Math.min(limit, 200))
    const { data, error } = await this.client
      .from("worker_data_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit)
    if (error) {
      throw new WorkerProfilePersistenceError("No se pudo leer el historial.", error)
    }
    return (data ?? []).map(mapWorkerEventRow)
  }

  /** getProfileQuality() — usa la función pura del dominio; no persiste. */
  async getProfileQuality(): Promise<ProfileQuality> {
    const current = await this.getCurrentProfile()
    if (current.state !== "configured") {
      return calculateProfileQuality(
        { userId: "", mode: "manual", identity: {}, situation: {}, sources: {}, updatedAt: "" },
        FIELD_REQUIREMENTS,
      )
    }
    return calculateProfileQuality(current.profile, FIELD_REQUIREMENTS)
  }

  /** getFieldRequirements() — devuelve la matriz sin duplicarla. */
  getFieldRequirements(): readonly FieldRequirement[] {
    return FIELD_REQUIREMENTS
  }
}
