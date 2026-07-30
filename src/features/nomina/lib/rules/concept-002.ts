import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const rule002: PayrollRule = {
  id: "002",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const amount = ctx.category.biweeklyBaseSalary
    const concept: CalculatedPayrollConcept = {
      code: "002",
      name: "Sueldo Base Fijo",
      type: "earning",
      nature: "base",
      amount,
      included: true,
      source: "salary_table",
      confidence: "high",
      verificationStatus: "contract_verified",
      dependencies: [],
      calculationSteps: [{ label: "Sueldo tabular quincenal", expression: `${ctx.category.biweeklyBaseSalary}`, value: amount }],
      legalBasis: [{ source: "CCT", title: "Tabulador de sueldos", reference: "Tabla salarial vigente SNTSS" }],
      warnings: [],
    }
    return { concept, dependencies: [] }
  },
}
