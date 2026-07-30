import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const concept078Rule: PayrollRule = {
  id: "078",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "078" && rc.confirmed && rc.appearsNormally === true
    )
    const hasFact = profile.facts.some(
      (f) => f.key === "performs_academic_activities" && f.value === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_078_on_payslip" && f.value === true
    )

    const eligible = isRecurring || (hasFact && hasPayslipEvidence)

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.10

    const concept: CalculatedPayrollConcept = {
      code: "078",
      name: "Actividades Académicas",
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
        { label: "078 = base × 10%", expression: `${base} × 0.10 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Actividades Académicas", reference: "Cláusula aplicable del CCT" }],
      warnings: eligible ? [] : ["Requiere unidad autorizada de Medicina Física y Rehabilitación y actividades académicas regulares"],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
