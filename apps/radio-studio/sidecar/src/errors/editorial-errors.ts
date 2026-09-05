/**
 * editorial-errors.ts — Errores de dominio tipados para La Veinte Radio.
 *
 * El motor editorial es Groq-Only. Si ocurre cualquiera de estos errores,
 * el sistema se detiene explícitamente y NO activa ningún fallback determinista
 * ni recurre a otros modelos locales.
 */

export class EditorialDomainError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly retryable: boolean;

  constructor(code: string, message: string, userMessage: string, retryable = false) {
    super(message);
    this.name = "EditorialDomainError";
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GroqUnavailableError extends EditorialDomainError {
  constructor(detail = "El motor editorial no está disponible.") {
    super(
      "GROQ_UNAVAILABLE",
      `GROQ_UNAVAILABLE: ${detail}`,
      "El motor editorial no está disponible en este momento. Tu investigación y el proyecto están guardados.",
      true
    );
  }
}

export class GroqRateLimitedError extends EditorialDomainError {
  public readonly retryAfterSec?: number;

  constructor(retryAfterSec?: number) {
    super(
      "GROQ_RATE_LIMITED",
      `GROQ_RATE_LIMITED: límite de solicitudes alcanzado${retryAfterSec ? ` (retry after ${retryAfterSec}s)` : ""}`,
      "El servicio alcanzó temporalmente su límite de solicitudes. Tu investigación y el proyecto están guardados.",
      true
    );
    this.retryAfterSec = retryAfterSec;
  }
}

export class GroqTimeoutError extends EditorialDomainError {
  constructor(timeoutMs = 60000) {
    super(
      "GROQ_TIMEOUT",
      `GROQ_TIMEOUT: tiempo de espera agotado (${timeoutMs}ms)`,
      "El motor editorial tardó demasiado en responder. Tu investigación y el proyecto están guardados.",
      true
    );
  }
}

export class GroqInvalidResponseError extends EditorialDomainError {
  constructor(detail: string) {
    super(
      "GROQ_INVALID_RESPONSE",
      `GROQ_INVALID_RESPONSE: ${detail}`,
      "El motor editorial devolvió una respuesta no interpretable.",
      true
    );
  }
}

export class GroqSchemaFailureError extends EditorialDomainError {
  constructor(task: string, detail: string) {
    super(
      "GROQ_SCHEMA_FAILURE",
      `GROQ_SCHEMA_FAILURE (${task}): ${detail}`,
      "La estructura del contenido generado no superó la validación técnica.",
      true
    );
  }
}

export class GroqGenerationFailedError extends EditorialDomainError {
  constructor(stage: string, originalError: unknown) {
    const msg = originalError instanceof Error ? originalError.message : String(originalError);
    super(
      "GROQ_GENERATION_FAILED",
      `GROQ_GENERATION_FAILED en etapa ${stage}: ${msg}`,
      "No pudimos generar el contenido del episodio en este momento.",
      true
    );
  }
}

export class InsufficientEvidenceError extends EditorialDomainError {
  constructor(topic: string, reason = "La biblioteca no contiene suficiente información verificada para explicar este tema con seguridad.") {
    super(
      "INSUFFICIENT_EVIDENCE",
      `INSUFFICIENT_EVIDENCE para tema "${topic}": ${reason}`,
      "La biblioteca no contiene suficiente información verificada para explicar este tema con seguridad.",
      false
    );
  }
}

export class ProposalGenerationFailedError extends EditorialDomainError {
  constructor(reason: string) {
    super(
      "PROPOSAL_GENERATION_FAILED",
      `PROPOSAL_GENERATION_FAILED: ${reason}`,
      "No fue posible generar una propuesta editorial que cumpla con los estándares de calidad.",
      true
    );
  }
}

export class ScriptQualityFailedError extends EditorialDomainError {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(
      "SCRIPT_QUALITY_FAILED",
      `SCRIPT_QUALITY_FAILED: ${issues.join("; ")}`,
      "El episodio no alcanzó el nivel de calidad necesario y no se generará audio. Puedes volver a intentarlo.",
      true
    );
    this.issues = issues;
  }
}

export class ProductionBlockedError extends EditorialDomainError {
  constructor(reason: string) {
    super(
      "PRODUCTION_BLOCKED",
      `PRODUCTION_BLOCKED: ${reason}`,
      "La producción de audio está bloqueada porque el guion no cuenta con verificación aprobada.",
      false
    );
  }
}
