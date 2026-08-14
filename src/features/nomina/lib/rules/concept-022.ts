import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { CLAUSE_63_BIS_C_DAYS } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { buildBaseForConcept } from "../repercussion-engine"

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/**
 * Derecho ANUAL contractual: días de ayuda de renta según la antigüedad
 * cumplida (Cláusula 63 Bis, inciso c). 0 días si < 5 años.
 */
export function calculateAnnualSeniorityEntitlement(input: {
  base: number
  completedYears: number
}): { days: number; annualAmount: number } {
  const days = input.completedYears < 5 ? 0 : (CLAUSE_63_BIS_C_DAYS[input.completedYears] ?? 270)
  const dailyValue = input.base / 15
  const annualAmount = round2(dailyValue * days)
  return { days, annualAmount }
}

/**
 * Componente QUINCENAL del derecho anual. No existe evidencia documental del
 * mecanismo de distribución (el repo no la contiene), por lo que este cálculo
 * es una ESTIMACIÓN de comprobación y siempre se marca como
 * pending_validation / requires_confirmation.
 */
export function calculateBiweeklySeniorityComponent(input: {
  annualAmount: number
  totalPaychecks?: number
}): { biweeklyComponent: number; totalPaychecks: number; pendingValidation: true } {
  const totalPaychecks = input.totalPaychecks ?? 24
  return {
    biweeklyComponent: round2(input.annualAmount / totalPaychecks),
    totalPaychecks,
    pendingValidation: true,
  }
}

/**
 * Ayuda de Renta por Antigüedad (022) — Cláusula 63 Bis, inciso c.
 *
 * La regla proyecta el DERECHO ANUAL (días × base ÷ 15). El derecho anual es
 * una prestación que NO aparece como percepción quincenal recurrente; si se
 * quiere un componente quincenal solo puede estimarse con
 * `calculateBiweeklySeniorityComponent`, marcado como pending_validation.
 *
 * La base se resuelve con el motor de repercusiones (002 + 011, y en su caso
 * 013 + 057 + 058 + 061), NO se asume únicamente el 002.
 */
export const rule022: PayrollRule = {
  id: "022",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011", "013", "057", "058", "061"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const completedYears = ctx.seniority.years

    // Base normativa del 022 según la matriz de repercusiones.
    const baseResult = buildBaseForConcept("022", ctx.calculatedConcepts, ctx.period.endDate)
    const base = baseResult.baseAmount > 0 ? baseResult.baseAmount : c002

    const { days, annualAmount } = calculateAnnualSeniorityEntitlement({ base, completedYears })
    const { biweeklyComponent } = calculateBiweeklySeniorityComponent({ annualAmount })

    const anchor = ctx.conceptAnchors.get("022")

    const DEPS = ["seniority"]
    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      annualAmount,
      status,
      ctx.mode,
    )

    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : "contract_rule"

    const warnings: string[] = [
      "Prestación anual — no reflejada como percepción quincenal recurrente",
      "Componente quincenal estimado (24 quincenas) solo como referencia: pendiente de validación del mecanismo de pago",
      `Componente quincenal estimado: ${biweeklyComponent.toFixed(2)} (pending_validation)`,
      ...resolutionWarnings,
    ]
    if (anchor) {
      const discrepancy = Math.abs(annualAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${annualAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "022",
      name: "Ayuda de Renta por Antigüedad (Cláusula 63 Bis, inciso c)",
      type: "earning",
      nature: "seniority_based",
      amount,
      included: false,
      source,
      confidence: "requires_confirmation",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : "formula_deduced",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: baseResult.integratedConcepts.map((i) => ({ code: i.code, amount: i.amount })),
      calculationSteps: [
        { label: "Antigüedad cumplida", expression: `${completedYears} años`, value: completedYears },
        { label: "Días según tabla", expression: `${days} días`, value: days },
        { label: "Base (repercusiones)", expression: `${baseResult.integratedConcepts.map((i) => `${i.code}=${i.amount.toFixed(2)}`).join(" + ")} = ${base}`, value: base },
        { label: "Valor diario", expression: `${base} ÷ 15 = ${round2(base / 15)}`, value: round2(base / 15) },
        { label: "Derecho anual", expression: `${round2(base / 15)} × ${days} = ${annualAmount}`, value: annualAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta por antigüedad", reference: "Cláusula 63 Bis, inciso c" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011", "013", "057", "058", "061"] }
  },
}
