import type { ConceptOccurrenceType, EligibilityPersistence } from "@/features/nomina/lib/types"

/**
 * Clasificación compartida de conceptos de percepción del tarjetón IMSS.
 *
 * Fuente única usada por:
 * - el sincronizador local (`features/tarjeton/services/payslip-sync.ts`), y
 * - el constructor server-side de recurrentes (`shared/server/worker-context.ts`),
 *   que reconstruye la lista COMPLETA desde `imported_payslip_lines` porque el
 *   RPC `confirm_imported_payslip` solo persiste un subconjunto histórico
 *   (050/023/063) en `payroll_contexts.recurring_concepts`.
 */

/** Códigos que además registran hecho booleano `concept_XXX_on_payslip`. */
export const PAYSLIP_FACT_CODES = new Set([
  "02", "012", "013",
  "051", "054", "057", "058",
  "061", "062", "072", "078", "083",
])

/**
 * Clasifica el tipo de ocurrencia de un concepto según su código.
 *
 * - recurring: aparece en cada tarjetón siempre (base, ayuda de renta, despensa).
 * - periodic: solo en quincenas específicas (fondo de ahorro julio).
 * - variable: aparece regularmente pero el importe depende de la base (derivados).
 * - unknown: conceptos no clasificados (horas extra, retroactivos, etc.).
 */
export function classifyOccurrence(code: string): ConceptOccurrenceType {
  const recurring = new Set(["002", "011", "020", "050", "023", "063"])
  if (recurring.has(code)) return "recurring"

  const periodic = new Set(["055"])
  if (periodic.has(code)) return "periodic"

  // 032/033: estímulos variables calibrados con tarjetón real 2A-AGO-2026
  // (base 002+011, truncamiento a centavos).
  const variable = new Set(["02", "012", "013", "022", "032", "033", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (variable.has(code)) return "variable"

  return "unknown"
}

/**
 * Clasifica la persistencia de elegibilidad según el código del concepto.
 */
export function classifyPersistence(code: string): EligibilityPersistence {
  const persistent = new Set(["002", "011", "020"])
  if (persistent.has(code)) return "persistent"
  const periodScoped = new Set(["055"])
  if (periodScoped.has(code)) return "period_scoped"
  const untilChanged = new Set(["02", "012", "013", "022", "050", "023", "063", "051", "054", "057", "058", "061", "062", "072", "078", "083"])
  if (untilChanged.has(code)) return "until_changed"
  return "event_scoped"
}
