import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getFixedAmount } from "../../data/fixed-concept-amounts"
import { hasConfirmedRecurrence } from "./concept-032"

/**
 * Ayuda para Despensa (050) — importe fijo versionado.
 *
 * El catálogo `fixed-concept-amounts` ahora contiene $200.00 quincenales
 * (observado en tarjetón real 2A-AGO-2026; pendiente confirmar monto oficial),
 * así que la regla es COMPUTABLE: la elegibilidad es evidencia ACTUAL de
 * recurrencia (prestación CCT sujeta a autorización administrativa), y el
 * ancla solo calibra/verifica bajo el contrato estándar de la familia.
 */
export const rule050: PayrollRule = {
  id: "050",
  version: "3.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const anchor = ctx.conceptAnchors.get("050")
    const entry = getFixedAmount("050", ctx.period.startDate)
    const fixedAmount = entry?.amount ?? 0

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
    if (!entry) {
      warnings.push("Sin monto configurado en el catálogo — pendiente de configuración")
    } else if (!anchor) {
      warnings.push("Monto $200 observado en un solo tarjetón real (2A-AGO-2026) — pendiente confirmar contra catálogo oficial")
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
      verificationStatus: "pending_validation",
      elegibilitySource: eligible ? (isRecurring ? "payslip_confirmed" : "formula_deduced") : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        ...(entry
          ? [{ label: "Monto quincenal (catálogo versionado)", expression: `$${fixedAmount}`, value: fixedAmount }]
          : [{ label: "Monto pendiente de configuración", expression: "Sin monto configurado en el catálogo", value: 0 }]),
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `${anchor!.amount}`, value: anchor!.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda para Despensa", reference: "Prestación del CCT", notes: "Importe observado empíricamente en tarjetón 2A-AGO-2026." }],
      warnings,
    }
    return { concept, dependencies: [] }
  },
}
