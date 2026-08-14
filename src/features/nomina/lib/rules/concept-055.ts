import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { buildBaseForConcept } from "../repercussion-engine"
import { calculateFondoAhorro, FONDO_AHORRO_CONSTANTS } from "@/shared/lib/fondo-ahorro"

/**
 * Fondo de Ahorro (055) — régimen ordinario.
 *
 * Base = sueldo tabular (002), excluye la prima 011 (p. 1A74-003-024).
 * Importe = (002 ÷ 15 × 46) × (unidades ÷ 360); se paga en la 2ª quincena de
 * julio. Si no hay unidades confirmadas se presenta el escenario de año
 * completo como supuesto (requires_confirmation). El 022 (ayuda de renta
 * anual) nunca integra esta base.
 */
export const rule055: PayrollRule = {
  id: "055",
  version: "2.1.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const anchor = ctx.conceptAnchors.get("055")

    // Base normativa: solo 002 repercute en 055 según el procedimiento.
    const baseResult = buildBaseForConcept("055", ctx.calculatedConcepts, ctx.period.endDate)
    const base = baseResult.baseAmount > 0 ? baseResult.baseAmount : c002

    const confirmedUnits = ctx.profile.fondoAhorro?.unidades
    const derivation = calculateFondoAhorro({
      sueldoTabular: base,
      unidades: confirmedUnits,
      regime: ctx.profile.fondoAhorro?.regime ?? "ordinario",
    })
    const formulaAmount = derivation.importeReal
    const fullAmount = derivation.fullAmount

    const isJulySecondHalf =
      ctx.period.month === FONDO_AHORRO_CONSTANTS.MONTH_PAYMENT &&
      ctx.period.half === FONDO_AHORRO_CONSTANTS.HALF_PAYMENT

    const eligible = anchor ? true : isJulySecondHalf

    const DEPS = ["002"]
    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      eligible ? formulaAmount : 0,
      status,
      ctx.mode,
    )

    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : "regulation_rule"

    const warnings: string[] = [
      ...derivation.warnings,
      ...resolutionWarnings,
      ...(isJulySecondHalf || anchor ? [] : ["Corresponde a la segunda quincena de julio — no aplica en esta quincena"]),
    ]
    if (anchor) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const confidence: "high" | "medium" | "low" | "requires_confirmation" =
      anchor ? "high" :
      !eligible ? "low" :
      derivation.requiresConfirmation ? "requires_confirmation" :
      "medium"

    const concept: CalculatedPayrollConcept = {
      code: "055",
      name: "Fondo de Ahorro",
      type: "earning",
      nature: "periodic",
      amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "regulation_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : "formula_deduced",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: base }],
      calculationSteps: [
        { label: "Base (régimen ordinario)", expression: `002 (sueldo tabular) = ${base}`, value: base },
        { label: "Valor diario", expression: `${base} ÷ 15 = ${derivation.dailyValue}`, value: derivation.dailyValue },
        { label: "Importe completo (46 días)", expression: `${derivation.dailyValue} × 46 = ${fullAmount}`, value: fullAmount },
        { label: "Unidades computables", expression: `${derivation.unidades} ÷ 360 = ${derivation.proporcion}`, value: derivation.proporcion },
        { label: "Importe del periodo", expression: `${fullAmount} × ${derivation.proporcion} = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [derivation.legalBasis],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
