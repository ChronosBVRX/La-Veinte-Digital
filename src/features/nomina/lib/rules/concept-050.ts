import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const rule050: PayrollRule = {
  id: "050",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(_ctx: PayrollRuleContext): RuleCalculationResult {
    void _ctx
    const concept: CalculatedPayrollConcept = {
      code: "050",
      name: "Ayuda para Despensa",
      type: "earning",
      nature: "fixed",
      amount: 0,
      included: false,
      source: "contract_rule",
      confidence: "requires_confirmation",
      verificationStatus: "pending_validation",
      dependencies: [],
      calculationSteps: [{ label: "Monto pendiente de configuración", expression: "Sin monto configurado en el catálogo", value: 0 }],
      legalBasis: [{ source: "CCT", title: "Ayuda para Despensa", reference: "Prestación del CCT" }],
      warnings: ["Monto pendiente de configurar — no incluida en el total"],
    }
    return { concept, dependencies: [] }
  },
}
