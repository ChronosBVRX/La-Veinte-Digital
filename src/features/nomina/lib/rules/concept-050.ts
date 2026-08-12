import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

export const rule050: PayrollRule = {
  id: "050",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const anchor = ctx.conceptAnchors.get("050")
    const eligible = anchor ? true : false

    const DEPS: string[] = []
    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      0,
      status,
      ctx.mode,
    )

    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : "contract_rule"

    const warnings: string[] = [...resolutionWarnings]
    if (anchor) {
      warnings.push("Monto obtenido del tarjetón — pendiente de configuración en catálogo")
    } else {
      warnings.push("Monto pendiente de configurar — no incluida en el total")
    }

    const concept: CalculatedPayrollConcept = {
      code: "050",
      name: "Ayuda para Despensa",
      type: "earning",
      nature: "fixed",
      amount,
      included: eligible,
      source,
      confidence: anchor ? "high" : "requires_confirmation",
      verificationStatus: "pending_validation",
      elegibilitySource: anchor ? "payslip_confirmed" : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [],
      calculationSteps: anchor
        ? [{ label: "Importe comprobado (tarjetón)", expression: `${anchor.amount}`, value: anchor.amount }]
        : [{ label: "Monto pendiente de configuración", expression: "Sin monto configurado en el catálogo", value: 0 }],
      legalBasis: [{ source: "CCT", title: "Ayuda para Despensa", reference: "Prestación del CCT" }],
      warnings,
    }
    return { concept, dependencies: [] }
  },
}
