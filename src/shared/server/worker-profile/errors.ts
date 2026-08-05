/**
 * Errores tipados del servicio de perfil laboral.
 *
 * Regla: NUNCA se exponen a la UI códigos internos de PostgreSQL, nombres de
 * políticas, SQL, UUID, ni detalles de RLS. Cada error conserva una causa
 * técnica para logging (message/cause) y un código funcional seguro.
 */

export type WorkerProfileErrorCode =
  | "unauthorized"
  | "unavailable"
  | "validation"
  | "consent_required"
  | "transition"
  | "persistence"

export class WorkerProfileError extends Error {
  readonly code: WorkerProfileErrorCode
  readonly causeTechnical?: unknown

  constructor(code: WorkerProfileErrorCode, message: string, causeTechnical?: unknown) {
    super(message)
    this.name = "WorkerProfileError"
    this.code = code
    this.causeTechnical = causeTechnical
  }
}

/** Sesión ausente o inválida. Nunca se acepta userId del cliente. */
export class WorkerProfileUnauthorizedError extends WorkerProfileError {
  constructor(causeTechnical?: unknown) {
    super("unauthorized", "No autenticado.", causeTechnical)
    this.name = "WorkerProfileUnauthorizedError"
  }
}

/** El perfil laboral no está disponible en este entorno (migración no activa). */
export class WorkerProfileUnavailableError extends WorkerProfileError {
  constructor(causeTechnical?: unknown) {
    super(
      "unavailable",
      "El perfil laboral no está disponible en este entorno.",
      causeTechnical,
    )
    this.name = "WorkerProfileUnavailableError"
  }
}

/** Entrada inválida (claves desconocidas, longitudes, enums, fechas, sources). */
export class WorkerProfileValidationError extends WorkerProfileError {
  constructor(message: string, causeTechnical?: unknown) {
    super("validation", message, causeTechnical)
    this.name = "WorkerProfileValidationError"
  }
}

/** Falta consentimiento vigente para la operación. */
export class WorkerProfileConsentRequiredError extends WorkerProfileError {
  constructor(causeTechnical?: unknown) {
    super(
      "consent_required",
      "Es necesario autorizar el uso de tus datos laborales para continuar.",
      causeTechnical,
    )
    this.name = "WorkerProfileConsentRequiredError"
  }
}

/** Transición de modo no permitida. */
export class WorkerProfileTransitionError extends WorkerProfileError {
  constructor(message: string, causeTechnical?: unknown) {
    super("transition", message, causeTechnical)
    this.name = "WorkerProfileTransitionError"
  }
}

/** Error al persistir (RPC falló, red, etc.). La causa técnica va a logging. */
export class WorkerProfilePersistenceError extends WorkerProfileError {
  constructor(message: string, causeTechnical?: unknown) {
    super("persistence", message, causeTechnical)
    this.name = "WorkerProfilePersistenceError"
  }
}
