/**
 * Contratos puros del dominio de información laboral.
 *
 * Este módulo NO depende de Supabase, React, localStorage, process.env ni
 * de ningún feature. Solo define tipos e invariantes del dominio del
 * trabajador. Las funciones puras viven en archivos hermanos.
 *
 * Reglas de este módulo:
 * - No importar tipos generados de Supabase.
 * - No importar clientes.
 * - No acceder a Date.now() dentro de funciones (se recibe la fecha).
 */

/** Estado del onboarding: independiente del perfil laboral persistido. */
export type WorkerOnboardingState = "unconfigured" | "basic" | "configured"

/**
 * Modo activo del perfil laboral.
 *
 * Nótese que NO existe "basic" aquí: "basic" es un estado de onboarding,
 * no un modo de perfil. Si el usuario eligió modo básico, simplemente no
 * existe perfil laboral (ni fila laboral).
 */
export type WorkerProfileMode = "manual" | "payslip"

/** Procedencia de un campo laboral. Nunca se inventa. */
export type WorkerFieldSource = "manual" | "payslip_confirmed" | "calculated" | "inferred"

/** Campos laborales reconocidos por el dominio. */
export type WorkerFieldName =
  | "matricula"
  | "adscripcion"
  | "categoria"
  | "workdayHours"
  | "shift"
  | "employmentType"
  | "effectiveSeniorityDate"

/** Identidad laboral: quién eres ante el IMSS. */
export interface WorkerIdentity {
  matricula?: string | null
  adscripcion?: string | null
  categoria?: string | null
}

export type Shift =
  | "matutino"
  | "vespertino"
  | "nocturno"
  | "jornada_acumulada"
  | "mixto"

export type EmploymentType =
  | "base"
  | "sustituto"
  | "interino"
  | "obra_determinada"
  | "confianza"
  | "otro"

export type JornadaHoras = 6 | 6.5 | 8 | 12

/** Situación laboral: en qué condiciones trabajas. */
export interface EmploymentSituation {
  workdayHours?: JornadaHoras | null
  shift?: Shift | null
  employmentType?: EmploymentType | null
  /** Fecha efectiva de ingreso (ISO, yyyy-mm-dd). */
  effectiveSeniorityDate?: string | null
}

/**
 * Perfil laboral del trabajador (agregado).
 * Invariantes: userId proviene de la sesión del servidor; nunca contiene
 * role/id/created_at/is_online; si no hay datos, no existe instancia.
 */
export interface WorkerProfile {
  userId: string
  mode: WorkerProfileMode
  identity: WorkerIdentity
  situation: EmploymentSituation
  /** Fuente por campo: "de dónde vino" es parte del dato. */
  sources: Partial<Record<WorkerFieldName, WorkerFieldSource>>
  updatedAt: string
}

/**
 * Borrador de captura/importación. Vive en el cliente y NO se persiste.
 * Solo se aplica tras confirmación explícita.
 */
export interface WorkerProfileDraft {
  mode: WorkerProfileMode
  identity: WorkerIdentity
  situation: EmploymentSituation
  confirmedFields: WorkerFieldName[]
}

/**
 * Actualización ya confirmada por el usuario.
 *
 * NO incluye userId: el usuario se obtiene únicamente desde la sesión del
 * servidor, de modo que un consumidor no puede seleccionar otra cuenta.
 */
export interface ConfirmedWorkerProfileUpdate {
  identity?: WorkerIdentity
  situation?: EmploymentSituation
  sources: Partial<Record<WorkerFieldName, WorkerFieldSource>>
  mode: WorkerProfileMode
  sourceOfRequest: "manual" | "payslip"
  consentRef?: ConsentReference
}

export interface ConsentReference {
  purpose: ConsentPurpose
  version: string
}

export type ConsentPurpose = "use_worker_data" | "store_tarjeton"

export type ConsentSource = "onboarding" | "worker_center" | "tarjeton" | "settings"

/**
 * Aceptación informada y versionada de una finalidad de tratamiento.
 * IP/UA son opcionales y SOLO si el aviso lo declara con retención limitada.
 */
export interface ConsentRecord {
  userId: string
  purpose: ConsentPurpose
  version: string
  acceptedAt: string
  acceptedSource: ConsentSource
  revokedAt?: string | null
  acceptedIp?: string
  acceptedUserAgent?: string
}

export type WorkerEventType =
  | "profile_created"
  | "mode_changed"
  | "tarjeton_imported"
  | "field_updated"
  | "consent_granted"
  | "consent_revoked"
  | "data_deleted"

export type WorkerEventPriority = "info" | "important" | "critical"

/**
 * Metadata técnica de un evento. NUNCA contiene valores de datos laborales:
 * está prohibido oldValue/newValue, salarios, matrículas, adscripciones,
 * categorías o cualquier clave no permitida (ver validateWorkerEventMetadata).
 */
export interface WorkerEventMetadata {
  [key: string]: unknown
}

/**
 * Evento de vida del perfil. Append-only: los consumidores NO pueden crearlo;
 * solo el servicio de dominio en servidor lo escribe. Para el usuario es
 * solo SELECT.
 */
export interface WorkerDataEvent {
  id: string
  userId: string
  eventType: WorkerEventType
  priority: WorkerEventPriority
  metadata: WorkerEventMetadata
  createdAt: string
}

export type ToolId =
  | "aguinaldo"
  | "prima_vacacional"
  | "vacaciones"
  | "nomina"
  | "simulador"
  | "tiempo_extra"
  | "escritos"
  | "comparador"
  | "prestaciones"
  | "timeline"
  | "tarjeton"

/**
 * Entrada de cálculo ya filtrada por consentimiento.
 * Solo lectura; nunca se persiste.
 */
export interface CalculationContext {
  profile: WorkerProfile
  /** catálogo → versión. Referencia el conocimiento, no lo copia. */
  catalogRefs: Record<string, string>
  targetDate: string
  tool: ToolId
}

/** Resultado de cálculo + explicación. No escribe al perfil. */
export interface CalculationResult {
  tool: ToolId
  period: string
  values: Record<string, number>
  explanation: CalculationExplanation
  confidence: number
}

/** Quién puede consumir un valor dentro de una explicación. */
export type ExplanationConsumer = "self" | "assistant" | "logs"

/**
 * Nivel de sensibilidad de un valor usado en una explicación. Determina
 * cómo se redacta según el consumidor.
 */
export type DataSensitivity = "public" | "labor" | "financial" | "identifier"

/**
 * Entrada de explicación con clasificación de sensibilidad. `displayValue`
 * es opcional y redactado según consumidor; nunca un valor libre sin etiqueta.
 */
export interface ExplanationInput {
  field: WorkerFieldName
  source: WorkerFieldSource
  displayValue?: string
  sensitivity: DataSensitivity
  allowedConsumers: ExplanationConsumer[]
}

export interface RuleRef {
  ruleId: string
  version: string
}

export interface CatalogRef {
  catalog: string
  version: string
}

/**
 * Explicación de un resultado: qué se obtuvo, con qué datos (redactables),
 * qué reglas y catálogos se usaron, qué se estimó, qué falta y confianza.
 * Referencia reglas/catálogos; no duplica fórmulas.
 */
export interface CalculationExplanation {
  resultLabel: string
  usedInputs: ExplanationInput[]
  rulesApplied: RuleRef[]
  catalogRefs: CatalogRef[]
  estimatedFields: WorkerFieldName[]
  missingFields: WorkerFieldName[]
  confidence: number
}

/**
 * Calidad derivada del perfil. NO se persiste; es un cálculo puro.
 * El porcentaje representa completitud y confianza relativa, no precisión
 * garantizada.
 */
export interface ProfileQuality {
  percent: number
  confidence: number
  confirmedCount: number
  manualCount: number
  inferredCount: number
  missingFields: WorkerFieldName[]
  recommendations: string[]
  benefitedTools: ToolId[]
}

/** Requerimiento de un campo por herramienta (matriz dato → herramienta). */
export interface FieldRequirement {
  field: WorkerFieldName
  purpose: string
  tools: Array<{ tool: ToolId; required: boolean }>
  preferredSource: WorkerFieldSource
  whyMessage: string
  impactIfMissing: string
}
