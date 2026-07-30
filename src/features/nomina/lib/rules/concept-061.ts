import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const concept061Rule: PayrollRule = {
  id: "061",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "061" && rc.confirmed && rc.appearsNormally === true
    )
    const hasFact = profile.facts.some(
      (f) => f.key === "works_in_emergency_transport" && f.value === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_061_on_payslip" && f.value === true
    )

    const eligible = isRecurring || (hasFact && hasPayslipEvidence)

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.10

    const concept: CalculatedPayrollConcept = {
      code: "061",
      name: "Traslado de Pacientes",
      type: "earning",
      nature: "derived",
      amount: eligible ? amount : 0,
      included: eligible,
      source: isRecurring ? "last_payslip" : "contract_rule",
      confidence: isRecurring ? "high" : "medium",
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "061 = base × 10%", expression: `${base} × 0.10 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Traslado de Pacientes", reference: "Cláusula aplicable del CCT" }],
      warnings: eligible ? [] : ["Requiere adscripción a vehículo de urgencias o terapia intensiva en CDMX/Valle de México"],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
