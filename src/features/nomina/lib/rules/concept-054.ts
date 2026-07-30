import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const rule054: PayrollRule = {
  id: "054",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "054" && rc.confirmed && rc.appearsNormally === true
    )
    const hasCondition = profile.occupationalConditions.some(
      (c) => c.type === "radiation_non_medical" && c.enabled && c.permanentExposure
    )
    const hasFact = profile.facts.some(
      (f) => f.key === "permanent_radiation_exposure" && f.value === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_054_on_payslip" && f.value === true
    )

    const eligible = isRecurring || hasCondition || hasFact || hasPayslipEvidence

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.20

    const confidence: "high" | "medium" | "low" | "requires_confirmation" =
      isRecurring ? "high" :
      hasPayslipEvidence ? "high" :
      eligible ? "medium" :
      "requires_confirmation"

    const concept: CalculatedPayrollConcept = {
      code: "054",
      name: "Emanaciones Radiactivas no Médicas",
      type: "earning",
      nature: "derived",
      amount: eligible ? amount : 0,
      included: eligible,
      source: isRecurring ? "last_payslip" : "contract_rule",
      confidence,
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "20% sobre base", expression: `${base} × 0.20 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Emanaciones Radiactivas no Médicas", reference: "Cláusula aplicable del CCT" }],
      warnings: eligible
        ? []
        : ["No se ha confirmado exposición constante y permanente a emanaciones radiactivas no médicas"],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
