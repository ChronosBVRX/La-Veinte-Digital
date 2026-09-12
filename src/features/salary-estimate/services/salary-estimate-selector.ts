import type { WorkerContext } from "@/shared/server/worker-context-builder"

/**
 * Adaptador: extrae sueldo tabular (002) y Concepto 11 (011) del tarjetón
 * activo canónico (`GET /api/worker-context` → `payroll.recurringConcepts`).
 *
 * Es la misma fuente que alimenta a las calculadoras (prerrelleno
 * `concepto002`/`concepto011`): líneas confirmadas del tarjetón activo
 * (`imported_payslip_lines`, mismo `activePayslipId`/periodo). No crea una
 * segunda fuente de verdad y no toca el parser del tarjetón.
 */

export interface SalaryEstimateSelection {
  hasPayslip: boolean
  tabular: unknown
  concept11: unknown
}

function findRecurringAmount(
  concepts: unknown,
  code: "002" | "011",
): number | undefined {
  if (!Array.isArray(concepts)) return undefined
  for (const entry of concepts) {
    if (!entry || typeof entry !== "object") continue
    const rec = entry as { conceptCode?: unknown; lastAmount?: unknown }
    if (rec.conceptCode !== code) continue
    if (typeof rec.lastAmount === "number" && Number.isFinite(rec.lastAmount)) {
      return rec.lastAmount
    }
    return undefined
  }
  return undefined
}

export function selectSalaryEstimateInputs(
  context: WorkerContext | null | undefined,
): SalaryEstimateSelection {
  const activePayslipId = context?.meta?.activePayslipId ?? null
  if (!context || !activePayslipId) {
    return { hasPayslip: false, tabular: undefined, concept11: undefined }
  }
  const concepts = context?.payroll?.recurringConcepts
  return {
    hasPayslip: true,
    tabular: findRecurringAmount(concepts, "002"),
    concept11: findRecurringAmount(concepts, "011"),
  }
}
