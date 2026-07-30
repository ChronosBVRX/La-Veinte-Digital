import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

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

    const isJulySecondHalf =
      ctx.period.month === 7 && ctx.period.half === 2

    const concept: CalculatedPayrollConcept = {
      code: "055",
      name: "Fondo de Ahorro",
      type: "earning",
      nature: "periodic",
      amount: fullAmount,
      included: isJulySecondHalf,
      source: "reconstructed_rule",
      confidence: isJulySecondHalf ? "medium" : "low",
      verificationStatus: "app_reconstructed",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${base}`, value: base },
        { label: "Valor diario", expression: `${base} ÷ 15 = ${dailyValue}`, value: dailyValue },
        { label: "Importe completo", expression: `${dailyValue} × 46 = ${fullAmount}`, value: fullAmount },
      ],
      legalBasis: [{ source: "reconstructed_application", title: "Fondo de Ahorro", reference: "Reconstruido de aplicación de referencia" }],
      warnings: [
        "Fórmula reconstruida de la aplicación de referencia — pendiente de validación normativa",
        ...(isJulySecondHalf ? [] : ["Corresponde a la segunda quincena de julio — no aplica en esta quincena"]),
      ],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
