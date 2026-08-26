import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getFixedAmount } from "../../data/fixed-concept-amounts"

export const rule020: PayrollRule = {
  id: "020",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const entry = getFixedAmount("020", ctx.period.startDate)
    const fixedAmount = entry?.amount ?? 250
    const anchor = ctx.conceptAnchors.get("020")

    const DEPS = ["fixedTable:020"]
    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "020",
      ruleId: "020",
      anchor,
      formulaAmount: fixedAmount,
      formulaComputable: true,
      eligibleNow: true,
      status,
      mode: ctx.mode,
      valuePersistence: "replay_only",
      period: ctx.period,
    })

    const source = resolution.usedAnchor ? "last_payslip" : "contract_rule"

    const warnings: string[] = [...resolution.warnings]
    if (anchor) {
      const discrepancy = Math.abs(fixedAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(
          `Importe real del último tarjetón (${anchor.amount.toFixed(2)}) difiere del monto fijo CCT (${fixedAmount.toFixed(2)})`
        )
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "020",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso a)",
      type: "earning",
      nature: "fixed",
      amount: resolution.amount,
      included: true,
      source,
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : "contract_rule",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Monto mensual CCT", expression: "$500 mensuales", value: 500 },
        { label: "Importe quincenal", expression: `$${fixedAmount}`, value: fixedAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta, inciso a", reference: "Cláusula 63 Bis, inciso a", notes: "$500 mensuales" }],
      warnings,
    }
    return { concept, dependencies: [] }
  },
}
