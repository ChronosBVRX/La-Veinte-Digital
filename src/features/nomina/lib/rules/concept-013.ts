import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const concept013Rule: PayrollRule = {
  id: "013",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "013" && rc.confirmed && rc.appearsNormally === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_013_on_payslip" && f.value === true
    )

    const eligible = isRecurring || hasPayslipEvidence

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.20

    const concept: CalculatedPayrollConcept = {
      code: "013",
      name: "Sobresueldo Médico",
      type: "earning",
      nature: "derived",
      amount: eligible ? amount : 0,
      included: eligible,
      source: isRecurring ? "last_payslip" : "contract_rule",
      confidence: isRecurring ? "high" : "requires_confirmation",
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "013 = base × 20%", expression: `${base} × 0.20 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Sobresueldo Médico", reference: "Cláusula aplicable del CCT" }],
      warnings: eligible ? [] : ["Requiere categoría médica autorizada y tabla SIAP aplicable"],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
