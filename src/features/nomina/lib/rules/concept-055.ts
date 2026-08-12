import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

export const rule055: PayrollRule = {
  id: "055",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const dailyValue = base / 15
    const fullAmount = dailyValue * 46
    const anchor = ctx.conceptAnchors.get("055")

    const isJulySecondHalf =
      ctx.period.month === 7 && ctx.period.half === 2

    const eligible = anchor ? true : isJulySecondHalf

    const DEPS = ["002", "011"]
    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      eligible ? fullAmount : 0,
      status,
      ctx.mode,
    )

    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : "reconstructed_rule"

    const warnings: string[] = [
      "Fórmula reconstruida de la aplicación de referencia — pendiente de validación normativa",
      ...resolutionWarnings,
      ...(isJulySecondHalf || anchor ? [] : ["Corresponde a la segunda quincena de julio — no aplica en esta quincena"]),
    ]
    if (anchor) {
      const discrepancy = Math.abs(fullAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${fullAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "055",
      name: "Fondo de Ahorro",
      type: "earning",
      nature: "periodic",
      amount,
      included: eligible,
      source,
      confidence: anchor ? "high" : (isJulySecondHalf ? "medium" : "low"),
      verificationStatus: "app_reconstructed",
      elegibilitySource: anchor ? "payslip_confirmed" : "formula_deduced",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${base}`, value: base },
        { label: "Valor diario", expression: `${base} ÷ 15 = ${dailyValue}`, value: dailyValue },
        { label: "Importe completo (46 días)", expression: `${dailyValue} × 46 = ${fullAmount}`, value: fullAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "reconstructed_application", title: "Fondo de Ahorro", reference: "Reconstruido de aplicación de referencia" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
