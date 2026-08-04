/**
 * Eventos del perfil laboral.
 *
 * Política:
 * - El historial es append-only y SOLO se escribe desde el servicio de
 *   dominio en el servidor. Los consumidores no pueden crear eventos.
 * - El metadata NUNCA contiene valores de datos laborales: están prohibidos
 *   oldValue/newValue, salarios, matrículas, adscripciones, categorías y
 *   cualquier clave no permitida.
 * - Al borrar datos laborales se conservan solo eventos mínimos no
 *   sensibles (data_deleted, consent_revoked, mode_changed); al eliminar la
 *   cuenta se elimina todo el historial.
 */
import type {
  WorkerEventMetadata,
  WorkerEventPriority,
  WorkerEventType,
} from "./types"

/** Prioridad por tipo de evento. */
export const EVENT_PRIORITY_BY_TYPE: Readonly<Record<WorkerEventType, WorkerEventPriority>> = {
  profile_created: "info",
  mode_changed: "info",
  field_updated: "info",
  tarjeton_imported: "important",
  consent_granted: "important",
  consent_revoked: "important",
  data_deleted: "critical",
}

/**
 * Claves permitidas en el metadata técnico de un evento.
 *
 * Sólo datos técnicos: modos, nombre de campo, fuente, versión de
 * consentimiento, método de extracción, confianza y periodo. NUNCA valores
 * de datos laborales.
 */
const ALLOWED_METADATA_KEYS: readonly string[] = [
  "modeFrom",
  "modeTo",
  "field",
  "source",
  "consentVersion",
  "consentPurpose",
  "extractionMethod",
  "confidence",
  "period",
]

const FORBIDDEN_METADATA_KEYS: readonly string[] = [
  "oldValue",
  "newValue",
  "salary",
  "matricula",
  "adscripcion",
  "categoria",
  "category",
  "full_name",
  "phone",
  "avatar",
]

/** Valida que el metadata solo contenga claves permitidas y sin valores sensibles. */
export function validateWorkerEventMetadata(
  metadata: WorkerEventMetadata,
): boolean {
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.includes(key)) return false
    if (!ALLOWED_METADATA_KEYS.includes(key)) return false
  }
  return true
}
