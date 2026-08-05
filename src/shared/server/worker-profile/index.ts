/**
 * Servicio de perfil laboral (capa servidor).
 *
 * Exposición pública del WorkerProfileService + errores tipados + adaptadores
 * de mapeo dominio/persistencia.
 */
export { WorkerProfileService } from "./service"
export type { WorkerProfileServiceDeps, WorkerProfileState, EffectiveConsentView } from "./service"
export { mapRpcError } from "./service"
export * from "./errors"
export * from "./adapters"
