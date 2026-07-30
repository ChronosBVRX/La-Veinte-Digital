import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { getFixedAmount } from "../../data/fixed-concept-amounts"

export const rule020: PayrollRule = {
  id: "020",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const entry = getFixedAmount("020", ctx.period.startDate)
    const amount = entry?.amount ?? 250
    const concept: CalculatedPayrollConcept = {
      code: "020",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso a)",
      type: "earning",
      nature: "fixed",
      amount,
      included: true,
      source: "contract_rule",
      confidence: "high",
      verificationStatus: "contract_verified",
      dependencies: [],
      calculationSteps: [
        { label: "Monto mensual CCT", expression: "$500 mensuales", value: 500 },
        { label: "Quincena ordinaria", expression: `$500 / 2 = $${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta, inciso a", reference: "Cláusula 63 Bis, inciso a", notes: "$500 mensuales" }],
      warnings: [],
    }
    return { concept, dependencies: [] }
  },
}
