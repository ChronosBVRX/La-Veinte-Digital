/**
 * Observabilidad y Telemetría Endurecida — La Veinte Digital
 *
 * Provee captura de excepciones, mensajes y métricas sanitizadas
 * sin registrar contraseñas, tokens, JWTs, CURP, RFC, NSS, matrículas,
 * cookies ni datos médicos/laborales sensibles.
 */

export type SeverityLevel = "info" | "warning" | "error" | "fatal"

export interface ObservabilityContext {
  [key: string]: unknown
}

export interface ObservabilityEvent {
  timestamp: string
  release: string
  level: SeverityLevel
  message: string
  errorName?: string
  errorMessage?: string
  stackTrace?: string
  context: Record<string, unknown>
  environment: string
}

export interface ObservabilityTransport {
  send(event: ObservabilityEvent): void | Promise<void>
}

// Patrones sensibles que NUNCA deben llegar a la observabilidad
const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /bearer/i,
  /auth(orization)?/i,
  /cookie/i,
  /jwt/i,
  /curp/i,
  /rfc/i,
  /nss/i,
  /matricula/i,
  /nomina/i,
  /sueldo/i,
  /salario/i,
  /tarjeton/i,
  /cuenta/i,
  /clabe/i,
  /tarjeta/i,
  /service_role/i,
  /apikey/i,
  /api_key/i,
]

const SENSITIVE_VALUE_PATTERNS = [
  /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i, // CURP
  /\b[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]\b/i, // RFC
  /\b\d{10,11}\b/, // NSS / Tel / Matrícula
  /bearer\s+[a-zA-Z0-9_\-\.]+/i, // Bearer tokens
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, // JWT
]

let currentRelease = process.env.NEXT_PUBLIC_APP_VERSION || "0.002"
let customTransport: ObservabilityTransport | null = null

export function setRelease(release: string): void {
  currentRelease = release
}

export function setObservabilityTransport(transport: ObservabilityTransport | null): void {
  customTransport = transport
}

/**
 * Sanitiza un valor recursivamente eliminando información personal y secretos.
 */
export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "boolean" || typeof value === "number") return value

  if (typeof value === "string") {
    let sanitized = value
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]")
    }
    // Truncate overly long values
    return sanitized.length > 500 ? sanitized.slice(0, 500) + "... [truncated]" : sanitized
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item))
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))
      if (isSensitiveKey) {
        result[key] = "[REDACTED]"
      } else {
        result[key] = sanitizeValue(val)
      }
    }
    return result
  }

  return String(value)
}

/**
 * Sanitiza el contexto de un evento de observabilidad.
 */
export function sanitizeContext(context: ObservabilityContext = {}): Record<string, unknown> {
  const sanitized = sanitizeValue(context)
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : { value: sanitized }
}

/**
 * Captura y reporta una excepción sanitizada.
 */
export function captureException(
  error: unknown,
  context: ObservabilityContext = {},
  level: SeverityLevel = "error",
): void {
  const isErr = error instanceof Error
  const event: ObservabilityEvent = {
    timestamp: new Date().toISOString(),
    release: currentRelease,
    level,
    message: isErr ? error.message : String(error),
    errorName: isErr ? error.name : typeof error,
    errorMessage: isErr ? error.message : String(error),
    stackTrace: isErr && error.stack ? error.stack.split("\n").slice(0, 10).join("\n") : undefined,
    context: sanitizeContext(context),
    environment: process.env.NODE_ENV || "development",
  }

  dispatchObservabilityEvent(event)
}

/**
 * Captura y reporta un mensaje de log/telemetría estructurado.
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = "info",
  context: ObservabilityContext = {},
): void {
  const event: ObservabilityEvent = {
    timestamp: new Date().toISOString(),
    release: currentRelease,
    level,
    message: String(sanitizeValue(message)),
    context: sanitizeContext(context),
    environment: process.env.NODE_ENV || "development",
  }

  dispatchObservabilityEvent(event)
}

function dispatchObservabilityEvent(event: ObservabilityEvent): void {
  if (customTransport) {
    try {
      customTransport.send(event)
    } catch {
      // Ignored: transport errors must never throw to caller
    }
    return
  }

  if (process.env.NODE_ENV !== "test") {
    const formatted = `[OBSERVABILITY:${event.level.toUpperCase()}] ${event.message} ${JSON.stringify(event.context)}`
    if (event.level === "error" || event.level === "fatal") {
      console.error(formatted, event.stackTrace || "")
    } else if (event.level === "warning") {
      console.warn(formatted)
    } else {
      console.info(formatted)
    }
  }
}

/**
 * Inicializador de escuchas globales para navegador (Window unhandled errors & promise rejections).
 */
export function initClientObservability(): void {
  if (typeof window === "undefined") return

  window.addEventListener("error", (event) => {
    captureException(event.error || event.message, {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason, {
      source: "window.unhandledrejection",
    })
  })
}
