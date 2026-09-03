/**
 * token-budget.ts — límites de tokens por etapa del pipeline Groq.
 *
 * Optimiza el flujo para no superar 8,000 TPM sin reducir calidad editorial.
 * Estimación simple: ~4 caracteres por token (conservadora para español).
 */

export interface TokenBudget {
  maxInputChars: number;
  maxOutputTokens: number;
}

/** ~4 chars por token en español */
const CHARS_PER_TOKEN = 4;

/**
 * Presupuesto por etapa.
 * Combined input + output ≤ 7,000 tokens por petición.
 */
export const STAGE_BUDGETS: Record<string, TokenBudget> = {
  // Análisis de tema / clasificación
  analysis: { maxInputChars: 6_000, maxOutputTokens: 500 },
  // Evaluación de evidencia
  evidence_evaluation: { maxInputChars: 8_000, maxOutputTokens: 600 },
  // Propuesta editorial (A y B)
  proposal: { maxInputChars: 10_000, maxOutputTokens: 1_400 },
  // Escaleta estructural
  outline: { maxInputChars: 8_000, maxOutputTokens: 600 },
  // Escritura de sección (profundidad: esencial → pro)
  dialogue_esencial: { maxInputChars: 8_000, maxOutputTokens: 2_500 },
  dialogue_equilibrado: { maxInputChars: 10_000, maxOutputTokens: 3_000 },
  dialogue_profundo: { maxInputChars: 12_000, maxOutputTokens: 3_500 },
  // Crítica de sección
  critique: { maxInputChars: 8_000, maxOutputTokens: 1_000 },
  // Reparación focalizada de un turno
  repair: { maxInputChars: 4_000, maxOutputTokens: 500 },
  // Puente comercial
  commercial_bridge: { maxInputChars: 2_000, maxOutputTokens: 300 },
};

/**
 * Trunca el texto al número máximo de caracteres estimados
 * para que no exceda el presupuesto de input de la etapa.
 * Siempre corta en límite de palabra completa.
 */
export function clampToInputBudget(text: string, stage: string): string {
  const budget = STAGE_BUDGETS[stage];
  if (!budget) return text;
  const maxChars = budget.maxInputChars;
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.9 ? truncated.slice(0, lastSpace) : truncated) +
    "\n[…texto truncado por presupuesto de tokens…]";
}

/**
 * Estima tokens de un texto (~4 chars/token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Verifica que el presupuesto combinado no exceda el límite de la petición (~7,000 tokens).
 * Retorna true si es seguro enviar.
 */
export function withinRequestBudget(inputText: string, stage: string): boolean {
  const budget = STAGE_BUDGETS[stage];
  if (!budget) return true;
  const inputTokens = estimateTokens(inputText);
  const combined = inputTokens + budget.maxOutputTokens;
  return combined <= 7_000;
}

/**
 * Devuelve el max_tokens recomendado para una etapa en Groq.
 */
export function maxTokensForStage(stage: string): number {
  return STAGE_BUDGETS[stage]?.maxOutputTokens ?? 2_000;
}
