import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export const rule011: PayrollRule = {
  id: "011",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const amount = round2(c002 * 0.8215)
    const concept: CalculatedPayrollConcept = {
      code: "011",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso b)",
      type: "earning",
      nature: "derived",
      amount,
      included: true,
      source: "contract_rule",
      confidence: "high",
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        { label: "002 del tabulador", expression: `002 = ${c002}`, value: c002 },
        { label: "011 = 002 x 0.8215", expression: `${c002} x 0.8215 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta, inciso b", reference: "Cláusula 63 Bis, inciso b" }],
      warnings: [],
    }
    return { concept, dependencies: ["002"] }
  },
}
