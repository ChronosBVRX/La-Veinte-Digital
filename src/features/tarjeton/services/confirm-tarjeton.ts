/**
 * Servicio de confirmación de tarjetones (lado servidor).
 *
 * El PDF nunca llega aquí: solo el resultado estructurado y confirmado
 * por el trabajador (contrato `ConfirmTarjetonRequest`). Este módulo
 * valida el contrato, descarta claves ajenas, recalcula los totales y
 * delega la persistencia atómica al RPC `confirm_imported_payslip`.
 */
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"
import {
  isConfirmTarjetonRequest,
  isConfirmTarjetonResponse,
} from "@/shared/contracts/tarjeton-import"
import { stripSensitiveFields } from "@/features/tarjeton/lib/sanitize-sensitive-fields"
import { validateTarjetonTotals } from "@/features/tarjeton/lib/validations"

export class ConfirmTarjetonError extends Error {
  constructor(
    public code: "invalid_payload" | "unauthorized" | "duplicate" | "totals_mismatch" | "matricula_mismatch" | "limits_exceeded" | "template_not_detected" | "consent_required" | "internal",
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

export interface ConfirmTarjetonServiceDeps {
  userId: string
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

function normalizeRpcResponse(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data) || "schemaVersion" in data) return data
  return { schemaVersion: "1.0", ...data }
}

/** Persiste la confirmación vía RPC (una sola transacción). */
export async function confirmTarjetonService(deps: ConfirmTarjetonServiceDeps, raw: unknown): Promise<ConfirmTarjetonResult> {
  let request: ConfirmTarjetonRequest
  try {
    request = sanitizeConfirmTarjetonRequest(raw)
  } catch (err) {
    if (err instanceof ConfirmTarjetonError) {
      return { ok: false, error: { code: err.code, message: err.message } }
    }
    return { ok: false, error: { code: "internal", message: "Error interno al validar el tarjetón." } }
  }

  try {
    const { data, error } = await deps.rpc("confirm_imported_payslip", {
      p_source_hash: request.sourceHash,
      p_parsed: request.parsed,
      p_profile_updates: request.profileUpdates,
      p_acknowledge_total_difference: request.acknowledgeTotalDifference,
      p_authorize_server_storage: request.authorizeServerStorage,
    })

    if (error) {
      console.error("[tarjeton/confirm][rpc]", { message: error.message })
      return mapRpcError(error.message)
    }
    const normalizedData = normalizeRpcResponse(data)
    if (!normalizedData || !isConfirmTarjetonResponse(normalizedData)) {
      return { ok: false, error: { code: "internal", message: "El servidor devolvió una respuesta inválida." } }
    }

    return { ok: true, data: normalizedData }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[tarjeton/confirm]", msg)
    return { ok: false, error: { code: "internal", message: "No fue posible confirmar el tarjetón." } }
  }
}

function mapRpcError(message: string): { ok: false; error: { code: ConfirmTarjetonError["code"]; message: string } } {
  const normalized = message.toLowerCase()

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
  return { ok: false, error: { code: "internal", message: "No fue posible confirmar el tarjetón." } }
}
