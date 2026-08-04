/**
 * Explicabilidad: redacción de valores según el consumidor.
 *
 * Reglas:
 * - La IA (assistant) nunca recibe identificadores ni datos financieros
 *   completos.
 * - Los logs nunca reciben valores.
 * - La UI del propio usuario (self) puede mostrar los valores autorizados.
 * - Las explicaciones exportadas respetan el consentimiento (via
 *   allowedConsumers del input).
 */
import type {
  CalculationExplanation,
  ExplanationConsumer,
  ExplanationInput,
} from "./types"

/**
 * Valores permitidos por consumidor según sensibilidad.
 *
 * self: puede ver todo lo que tenga self en allowedConsumers.
 * assistant: puede ver lo que tenga assistant, pero se redacta
 *   identifier y financial (se elimina displayValue).
 * logs: nunca conserva displayValue.
 */
function shouldKeepDisplayValue(
  input: ExplanationInput,
  consumer: ExplanationConsumer,
): boolean {
  if (!input.allowedConsumers.includes(consumer)) return false
  if (consumer === "logs") return false
  if (consumer === "assistant") {
    if (input.sensitivity === "identifier" || input.sensitivity === "financial") {
      return false
    }
  }
  return true
}

/**
 * Devuelve una copia de la explicación redactada para el consumidor.
 * No muta el original.
 */
export function sanitizeExplanationForConsumer(
  explanation: CalculationExplanation,
  consumer: ExplanationConsumer,
): CalculationExplanation {
  const usedInputs: ExplanationInput[] = explanation.usedInputs.map((input) => {
    if (!input.allowedConsumers.includes(consumer)) {
      return { ...input, displayValue: undefined }
    }
    return {
      ...input,
      displayValue: shouldKeepDisplayValue(input, consumer)
        ? input.displayValue
        : undefined,
    }
  })

  return {
    ...explanation,
    usedInputs,
  }
}

/**
 * Determina si un consumidor está autorizado a ver un input.
 * Útil como guardia antes de exponer cualquier explicación.
 */
export function canConsumerSeeInput(
  input: ExplanationInput,
  consumer: ExplanationConsumer,
): boolean {
  return input.allowedConsumers.includes(consumer)
}
