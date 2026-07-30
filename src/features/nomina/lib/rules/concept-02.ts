import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const concept02Rule: PayrollRule = {
  id: "02",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_02_on_payslip" && f.value === true
    )
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "02" && rc.confirmed && rc.appearsNormally === true
    )

    const eligible = isRecurring || hasPayslipEvidence

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.1586

    const concept: CalculatedPayrollConcept = {
      code: "02",
      name: "Transporte y Control de Vehículos",
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
        { label: "02 = base × 15.86%", expression: `${base} × 0.1586 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Transporte y Control de Vehículos", reference: "Cláusula aplicable del CCT" }],
      warnings: eligible ? [] : ["Requiere categoría, módulo y región autorizada, y asociación administrativa"],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
