/**
 * Servicio de confirmación de tarjetones (lado servidor).
 *
 * El PDF nunca llega aquí: solo el resultado estructurado y confirmado
 * por el trabajador (contrato `ConfirmTarjetonRequest`). Este módulo
 * valida el contrato, descarta claves ajenas, recalcula los totales,
 * sanitiza los campos secundarios (observaciones, fechas auxiliares,
 * confianzas) y delega la persistencia atómica al RPC
 * `confirm_imported_payslip`.
 */
import { randomUUID } from "node:crypto"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"
import {
  isConfirmTarjetonRequest,
  isConfirmTarjetonResponse,
} from "@/shared/contracts/tarjeton-import"
import { stripSensitiveFields } from "@/features/tarjeton/lib/sanitize-sensitive-fields"
import { validateTarjetonTotals } from "@/features/tarjeton/lib/validations"
import { sanitizeTarjetonForPersistence } from "@/features/tarjeton/lib/safe-values"

export class ConfirmTarjetonError extends Error {
  constructor(
    public code: "invalid_payload" | "unauthorized" | "duplicate" | "totals_mismatch" | "matricula_mismatch" | "limits_exceeded" | "template_not_detected" | "consent_required" | "persistence_failed" | "internal",
    message: string,
  ) {
    super(message)
    this.name = "ConfirmTarjetonError"
  }
}

export type ConfirmTarjetonResult = {
  ok: true
  data: ConfirmTarjetonResponse
} | {
  ok: false
  error: { code: ConfirmTarjetonError["code"]; message: string }
}

/**
 * Valida y normaliza el cuerpo recibido.
 * - Rechaza cualquier clave ajena al contrato (p. ej. RFC, NSS, cuentas).
 * - Recalcula los totales y exige reconocimiento si no cuadran.
 */
export function sanitizeConfirmTarjetonRequest(raw: unknown): ConfirmTarjetonRequest {
  if (!isConfirmTarjetonRequest(raw)) {
    throw new ConfirmTarjetonError("invalid_payload", "El cuerpo no cumple el contrato del tarjetón.")
  }

  const sanitized = stripSensitiveFields(raw)
  if (!isConfirmTarjetonRequest(sanitized)) {
    throw new ConfirmTarjetonError("invalid_payload", "El cuerpo contiene campos no permitidos.")
  }

  const totals = validateTarjetonTotals(sanitized.parsed)
  const mismatched = totals.earningsTotalMatches === false || totals.deductionsTotalMatches === false || totals.netPayMatches === false
  if (mismatched && !sanitized.acknowledgeTotalDifference) {
    throw new ConfirmTarjetonError(
      "totals_mismatch",
      "Los totales del tarjetón no coinciden con la suma de conceptos. Revisa los importes antes de confirmar.",
    )
  }

  if (!sanitized.parsed.extraction.validations.templateDetected) {
    throw new ConfirmTarjetonError("template_not_detected", "El archivo no parece un tarjetón del IMSS.")
  }

  const unconfirmed = [...sanitized.parsed.payroll.earnings, ...sanitized.parsed.payroll.deductions]
    .some((line) => !line.confirmedByUser)
  if (unconfirmed) {
    throw new ConfirmTarjetonError("invalid_payload", "Confirma cada concepto antes de guardar el tarjetón.")
  }

  return sanitized
}

export interface RpcError {
  message: string
  code?: string
  details?: string
  hint?: string | null
}

export interface ConfirmTarjetonServiceDeps {
  userId: string
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }>
}

function normalizeRpcResponse(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data) || "schemaVersion" in data) return data
  return { schemaVersion: "1.0", ...data }
}

/** Persiste la confirmación vía RPC (una sola transacción). */
export async function confirmTarjetonService(deps: ConfirmTarjetonServiceDeps, raw: unknown): Promise<ConfirmTarjetonResult> {
  const requestId = randomUUID()

  let request: ConfirmTarjetonRequest
  try {
    request = sanitizeConfirmTarjetonRequest(raw)
  } catch (err) {
    if (err instanceof ConfirmTarjetonError) {
      return { ok: false, error: { code: err.code, message: err.message } }
    }
    console.error("[tarjeton/confirm][validate]", { requestId, error: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: { code: "internal", message: "Error interno al validar el tarjetón." } }
  }

  // Datos secundarios: normaliza valores inválidos a undefined + warning.
  // Datos críticos fuera de rango: se rechazan con mensaje claro.
  const sanitization = sanitizeTarjetonForPersistence(request.parsed)
  if (sanitization.critical.length > 0) {
    console.error("[tarjeton/confirm][critical]", { requestId, critical: sanitization.critical })
    return {
      ok: false,
      error: {
        code: "invalid_payload",
        message: "Uno o más importes del tarjetón están fuera de rango. Corrige o elimina la fila antes de confirmar.",
      },
    }
  }
  request.parsed = sanitization.parsed

  // Registro técnico NO sensible: nunca incluye nombre, matrícula, RFC,
  // CURP ni NSS. Solo conteos, totales y metadatos de extracción.
  console.info("[tarjeton/confirm][request]", {
    requestId,
    earnings: request.parsed.payroll.earnings.length,
    deductions: request.parsed.payroll.deductions.length,
    observations: request.parsed.payroll.observations.length,
    totalEarnings: request.parsed.payroll.totalEarnings,
    totalDeductions: request.parsed.payroll.totalDeductions,
    netPay: request.parsed.payroll.netPay,
    method: request.parsed.extraction.method,
    globalConfidence: request.parsed.extraction.globalConfidence,
    period: request.parsed.document.periodRaw,
    sanitizedSecondaryFields: sanitization.sanitized.length,
  })

  try {
    const { data, error } = await deps.rpc("confirm_imported_payslip", {
      p_source_hash: request.sourceHash,
      p_parsed: request.parsed,
      p_profile_updates: request.profileUpdates,
      p_acknowledge_total_difference: request.acknowledgeTotalDifference,
      p_authorize_server_storage: request.authorizeServerStorage,
    })

    if (error) {
      return mapRpcError(error, requestId)
    }
    const normalizedData = normalizeRpcResponse(data)
    if (!normalizedData || !isConfirmTarjetonResponse(normalizedData)) {
      return { ok: false, error: { code: "internal", message: "El servidor devolvió una respuesta inválida." } }
    }

    return { ok: true, data: normalizedData }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : ''
    console.error("[tarjeton/confirm]", { requestId, error: msg, stack })
    return { ok: false, error: { code: "internal", message: "No fue posible confirmar el tarjetón." } }
  }
}

const OBS_FAILED_PATTERN = /obs_insert_failed:\s*line\s+(\d+)\s+code\s+(\S*)\s+amount\s+(\S*)\s+units\s+(\S*)\s+initialCharge\s+(\S*)\s+error\s+(.*)/
const LINE_FAILED_PATTERN = /line_insert_failed:\s*line\s+(\d+)\s+code\s+(\S*)\s+amount\s+(\S*)\s+confidence\s+(\S*)\s+error\s+(.*)/

function mapRpcError(error: RpcError, requestId: string): { ok: false; error: { code: ConfirmTarjetonError["code"]; message: string } } {
  const message = error.message
  const normalized = message.toLowerCase()

  // Diagnóstico específico de la migración 017: identifica línea, campo y
  // valor causante ANTES de traducir el error a un código de contrato.
  const obsMatch = message.match(OBS_FAILED_PATTERN)
  if (obsMatch) {
    console.error("[tarjeton/confirm][obs_insert_failed]", {
      requestId,
      line: obsMatch[1],
      code: obsMatch[2],
      amount: obsMatch[3],
      units: obsMatch[4],
      initialCharge: obsMatch[5],
      error: obsMatch[6],
      supabaseCode: error.code,
      details: error.details,
      hint: error.hint,
    })
    return {
      ok: false,
      error: {
        code: "persistence_failed",
        message: "No fue posible guardar el tarjetón por un dato de observaciones inválido. Intenta de nuevo; si persiste, contáctanos.",
      },
    }
  }

  const lineMatch = message.match(LINE_FAILED_PATTERN)
  if (lineMatch) {
    console.error("[tarjeton/confirm][line_insert_failed]", {
      requestId,
      line: lineMatch[1],
      code: lineMatch[2],
      amount: lineMatch[3],
      confidence: lineMatch[4],
      error: lineMatch[5],
      supabaseCode: error.code,
      details: error.details,
      hint: error.hint,
    })
    return {
      ok: false,
      error: {
        code: "persistence_failed",
        message: "No fue posible guardar el tarjetón por un dato de conceptos inválido. Revisa los importes e intenta de nuevo.",
      },
    }
  }

  console.error("[tarjeton/confirm][rpc]", {
    requestId,
    code: error.code,
    message,
    details: error.details,
    hint: error.hint,
  })

  if (normalized.includes("duplicate") || normalized.includes("already exists")) {
    return { ok: false, error: { code: "duplicate", message: "Este tarjetón ya fue confirmado antes." } }
  }
  if (normalized.includes("totals_mismatch")) {
    return { ok: false, error: { code: "totals_mismatch", message: "Los totales del tarjetón no coinciden con la suma de conceptos." } }
  }
  if (normalized.includes("matricula_mismatch")) {
    return { ok: false, error: { code: "matricula_mismatch", message: "La matrícula del tarjetón no coincide con la del perfil y no fue autorizado el cambio." } }
  }
  if (normalized.includes("limits_exceeded")) {
    return { ok: false, error: { code: "limits_exceeded", message: "El tarjetón excede los límites de líneas u observaciones." } }
  }
  if (normalized.includes("unauthorized") || normalized.includes("unauthenticated")) {
    return { ok: false, error: { code: "unauthorized", message: "No autenticado." } }
  }
  if (normalized.includes("invalid_payload")) {
    return { ok: false, error: { code: "invalid_payload", message: "El contenido no cumple el contrato del tarjetón." } }
  }
  if (normalized.includes("consent_required")) {
    return { ok: false, error: { code: "consent_required", message: "Es necesario autorizar el guardado de tus datos para continuar." } }
  }
  if (
    normalized.includes("numeric field overflow") ||
    normalized.includes("value too long") ||
    normalized.includes("invalid input syntax") ||
    normalized.includes("out of range")
  ) {
    return {
      ok: false,
      error: {
        code: "persistence_failed",
        message: "No fue posible guardar el tarjetón por un valor fuera de rango. Intenta de nuevo; si persiste, contáctanos.",
      },
    }
  }
  return { ok: false, error: { code: "internal", message: "No fue posible confirmar el tarjetón." } }
}
