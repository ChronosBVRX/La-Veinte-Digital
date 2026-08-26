import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { anchorCoversPeriod } from "../engine"

export const rule002: PayrollRule = {
  id: "002",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const catalogAmount = ctx.category.biweeklyBaseSalary
    const anchor = ctx.conceptAnchors.get("002")
    const warnings: string[] = []

    // Baseline reproduce el ancla SOLO si es el mismo periodo del tarjetón.
    if (ctx.mode === "baseline" && anchor && anchorCoversPeriod(anchor, ctx.period)) {
      const amount = anchor.amount
      const source = "last_payslip"

      if (Math.abs(anchor.amount - catalogAmount) > 0.50) {
        warnings.push(`Importe tabular (${catalogAmount.toFixed(2)}) difiere del comprobado en tarjetón (${anchor.amount.toFixed(2)})`)
      }

      const concept: CalculatedPayrollConcept = {
        code: "002",
        name: "Sueldo Base Fijo",
        type: "earning",
        nature: "base",
        amount,
        included: true,
        source,
        confidence: "high",
        verificationStatus: "contract_verified",
        elegibilitySource: "payslip_confirmed",
        anchorAmount: anchor.amount,
        anchorDate: anchor.date,
        dependencies: [],
        calculationSteps: [
          { label: "Sueldo tabular quincenal (catálogo)", expression: `${catalogAmount}`, value: catalogAmount },
          { label: "Último tarjetón (referencia)", expression: `${anchor.amount}`, value: anchor.amount },
        ],
        legalBasis: [{ source: "CCT", title: "Tabulador de sueldos", reference: "Tabla salarial vigente SNTSS" }],
        warnings,
      }
      return { concept, dependencies: [] }
    }

    if (anchor && Math.abs(anchor.amount - catalogAmount) > 0.50) {
      warnings.push(`Importe tabular (${catalogAmount.toFixed(2)}) difiere del comprobado en tarjetón (${anchor.amount.toFixed(2)})`)
    }

    const concept: CalculatedPayrollConcept = {
      code: "002",
      name: "Sueldo Base Fijo",
      type: "earning",
      nature: "base",
      amount: catalogAmount,
      included: true,
      source: "salary_table",
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource: "tabular_value",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [],
      calculationSteps: [
        { label: "Sueldo tabular quincenal (catálogo)", expression: `${catalogAmount}`, value: catalogAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Tabulador de sueldos", reference: "Tabla salarial vigente SNTSS" }],
      warnings,
    }
    return { concept, dependencies: [] }
  },
}
