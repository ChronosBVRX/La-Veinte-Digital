import type { CommitmentInsert } from "./commitments-supabase"
import { PRIMARY_COMMITMENT_TYPES, type CommitmentType } from "../types"

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Valida un compromiso antes de guardarlo en base de datos.
 * Evita que se registren tipos o campos inválidos mediante llamadas directas.
 */
export function validateCommitmentInput(input: Partial<CommitmentInsert>): ValidationResult {
  const errors: string[] = []

  if (!input.type) {
    errors.push("El tipo de registro es obligatorio.")
    return { ok: false, errors }
  }

  // Verificar que el tipo pertenezca a los autorizados para nuevas altas
  if (!PRIMARY_COMMITMENT_TYPES.includes(input.type as CommitmentType)) {
    errors.push(`El tipo '${input.type}' no está permitido para nuevas altas en la agenda.`)
    return { ok: false, errors }
  }

  if (!input.user_id) {
    errors.push("El identificador de usuario (user_id) es obligatorio.")
  }

  if (!input.start_at || isNaN(new Date(input.start_at).getTime())) {
    errors.push("La fecha/hora de inicio es obligatoria y debe ser válida.")
  }

  const details = (input.details && typeof input.details === "object" && !Array.isArray(input.details)
    ? input.details
    : {}) as Record<string, unknown>

  switch (input.type) {
    case "overtime": {
      if (!input.end_at || isNaN(new Date(input.end_at).getTime())) {
        errors.push("La hora de término del tiempo extra es obligatoria.")
      } else if (input.start_at) {
        const start = new Date(input.start_at).getTime()
        const end = new Date(input.end_at).getTime()
        const diffHours = (end - start) / (1000 * 60 * 60)
        if (diffHours <= 0 || diffHours > 24) {
          errors.push("La duración del tiempo extra debe ser mayor a 0 y no exceder 24 horas.")
        }
      }
      const shift = details.shift || details.affectedShift
      if (!shift || typeof shift !== "string") {
        errors.push("El turno del tiempo extra es obligatorio.")
      }
      if (!details.authorizedBy || typeof details.authorizedBy !== "string" || !details.authorizedBy.trim()) {
        errors.push("La persona que autorizó el tiempo extra es obligatoria.")
      }
      break
    }

    case "falta_injustificada": {
      const shift = details.affectedShift || details.shift
      if (!shift || typeof shift !== "string") {
        errors.push("El turno afectado por la falta injustificada es obligatorio.")
      }
      break
    }

    case "no_pagado": {
      if (!input.title || !input.title.trim()) {
        errors.push("El concepto o qué estás reclamando es obligatorio.")
      }
      if (!details.claimFiledDate || typeof details.claimFiledDate !== "string") {
        errors.push("La fecha de presentación de la reclamación es obligatoria.")
      }
      if (details.claimStatus && !["pendiente", "en_seguimiento", "resuelta"].includes(details.claimStatus as string)) {
        errors.push("El estado de la reclamación debe ser: pendiente, en_seguimiento o resuelta.")
      }
      break
    }

    case "txt_substitution": {
      if (!input.substitute_worker_name || !input.substitute_worker_name.trim()) {
        errors.push("La persona a quien vas a sustituir en el TxT es obligatoria.")
      }
      const shift = details.affectedShift || details.shift
      if (!shift || typeof shift !== "string") {
        errors.push("El turno del TxT es obligatorio.")
      }
      if (!input.end_at || isNaN(new Date(input.end_at).getTime())) {
        errors.push("La hora de término de la sustitución TxT es obligatoria.")
      }
      if (details.paidStatus && !["si", "no", "pendiente"].includes(details.paidStatus as string)) {
        errors.push("El estado de pago debe ser: si, no o pendiente.")
      }
      break
    }

    case "general_reminder": {
      if (!input.title || !input.title.trim()) {
        errors.push("El título del recordatorio es obligatorio.")
      }
      if (details.priority && !["normal", "importante", "urgente"].includes(details.priority as string)) {
        errors.push("La prioridad debe ser: normal, importante o urgente.")
      }
      if (details.recurrence && !["none", "daily", "weekly", "monthly"].includes(details.recurrence as string)) {
        errors.push("La repetición debe ser: none, daily, weekly o monthly.")
      }
      break
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}
