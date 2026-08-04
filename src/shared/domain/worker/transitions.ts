/**
 * Máquina de estados del dominio laboral.
 *
 * Dos ejes separados:
 * - WorkerOnboardingState: cuánto ha avanzado el usuario en el onboarding.
 * - WorkerProfileMode: cómo está configurado el perfil laboral (solo si
 *   existe). No existe "basic" como modo de perfil: si el usuario eligió
 *   modo básico, no hay perfil laboral.
 */
import type {
  WorkerOnboardingState,
  WorkerProfileMode,
} from "./types"

/** Transiciones válidas del onboarding. */
export type OnboardingTransition = {
  from: WorkerOnboardingState
  to: WorkerOnboardingState
}

const VALID_ONBOARDING_TRANSITIONS: readonly OnboardingTransition[] = [
  { from: "unconfigured", to: "basic" },
  { from: "unconfigured", to: "configured" },
  { from: "basic", to: "configured" },
  { from: "configured", to: "basic" },
]

/**
 * Valida una transición del estado de onboarding.
 *
 * Reglas:
 * - unconfigured → basic / configured (primera decisión).
 * - basic → configured (activa perfil laboral más tarde).
 * - configured → basic (borra datos laborales conservando la cuenta).
 * - Cualquier otra (incluidas quedarse en el mismo estado) es inválida.
 */
export function isValidOnboardingTransition(
  from: WorkerOnboardingState,
  to: WorkerOnboardingState,
): boolean {
  return VALID_ONBOARDING_TRANSITIONS.some(
    (t) => t.from === from && t.to === to,
  )
}

const VALID_WORKER_MODES: readonly WorkerProfileMode[] = ["manual", "payslip"]

/**
 * Valida una transición del modo del perfil laboral (manual ↔ payslip).
 *
 * Reglas:
 * - manual → payslip (importar tarjetón que pasa a ser fuente activa).
 * - payslip → manual (cambiar a captura manual conservando tarjetones como
 *   evidencia histórica).
 * - Cualquier valor que no sea un modo válido es rechazado.
 */
export function isValidWorkerModeTransition(
  from: WorkerProfileMode,
  to: WorkerProfileMode,
): boolean {
  if (!VALID_WORKER_MODES.includes(from) || !VALID_WORKER_MODES.includes(to)) {
    return false
  }
  return from !== to
}

/** Lista de modos de perfil laboral válidos (útil para validación en runtime). */
export const WORKER_PROFILE_MODES: readonly WorkerProfileMode[] = VALID_WORKER_MODES
