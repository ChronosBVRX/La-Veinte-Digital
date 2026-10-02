import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getFixedAmount } from "../../data/fixed-concept-amounts"
import { hasConfirmedRecurrence } from "./concept-032"

/**
 * Ayuda para Despensa (050) — Cláusula 142 Bis del CCT ($200.00 quincenales).
 *
 * El catálogo `fixed-concept-amounts` contiene $200.00 quincenales
 * ($400.00 mensuales) conforme a la Cláusula 142 Bis del CCT.
 * Regla COMPUTABLE: la elegibilidad es evidencia ACTUAL de recurrencia
 * o asignación contractual confirmada en tarjetón.
 */
export const rule050: PayrollRule = {
  id: "050",
  version: "4.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const anchor = ctx.conceptAnchors.get("050")
    const entry = getFixedAmount("050", ctx.period.startDate)
    const fixedAmount = entry?.amount ?? 200

    const isRecurring = hasConfirmedRecurrence("050", ctx.profile)
    const eligible = isRecurring || !!anchor

    const DEPS = ["fixedTable:050"]
    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "050",
      ruleId: "050",
      anchor,
      formulaAmount: fixedAmount,
      formulaComputable: true,
      eligibleNow: eligible,
      status,
      mode: ctx.mode,
      valuePersistence: "replay_only",
      period: ctx.period,
    })

    const warnings: string[] = [...resolution.warnings]
    if (!eligible) {
      warnings.push("Requiere evidencia de Ayuda para Despensa en tarjetón o confirmación del usuario")
    }

    const concept: CalculatedPayrollConcept = {
      code: "050",
      name: "Ayuda para Despensa",
      type: "earning",
      nature: "fixed",
      amount: resolution.amount,
      included: eligible,
      source: resolution.usedAnchor ? "last_payslip" : "contract_rule",
      confidence: resolution.requiresConfirmation ? "requires_confirmation" : isRecurring || anchor ? "high" : "medium",
      verificationStatus: "contract_verified",
      elegibilitySource: eligible ? (isRecurring ? "payslip_confirmed" : "formula_deduced") : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Monto quincenal contractual", expression: `$${fixedAmount} (Cláusula 142 Bis CCT)`, value: fixedAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `${anchor!.amount}`, value: anchor!.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda para Despensa", reference: "Cláusula 142 Bis del CCT", notes: "$200.00 quincenales ($400.00 mensuales en vales de consumo)" }],
      warnings,
    }
    return { concept, dependencies: [] }
  },
}
