import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { truncateCurrency } from "../money"
import { hasConfirmedRecurrence } from "./concept-032"

/**
 * Estímulo por Puntualidad (033) — Art. 93 del RIT.
 *
 * Calibración empírica (tarjetón real 2A-AGO-2026, TÉCNICO RADIÓLOGO 80):
 *   base = 002 + 011 = 7,172.41
 *   033  = trunc2(7172.41 × 16%) = $1,147.58 ✓
 *
 * Mismo contrato de ancla y base observada que el 032 (grupo extendido
 * previo refutado por la observación real).
 */
export const concept033Rule: PayrollRule = {
  id: "033",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  valuePersistence: "while_dependencies_unchanged",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const anchor = ctx.conceptAnchors.get("033")
    const isRecurring = hasConfirmedRecurrence("033", profile)

    const eligible = isRecurring

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = truncateCurrency(base * 0.16)

    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "033",
      ruleId: "033",
      anchor,
      formulaAmount,
      formulaComputable: true,
      eligibleNow: eligible,
      status,
      mode: ctx.mode,
      valuePersistence: "while_dependencies_unchanged",
      period: ctx.period,
    })

    const source = resolution.usedAnchor ? "last_payslip" : "contract_rule"

    let confidence: CalculatedPayrollConcept["confidence"] =
      isRecurring ? "high" : "requires_confirmation"
    if (resolution.requiresConfirmation) confidence = "requires_confirmation"

    const warnings: string[] = [...resolution.warnings]
    if (!eligible) {
      warnings.push("Requiere evidencia de estímulo por puntualidad en tarjetón (se pierde por retardos según RIT)")
    }
    warnings.push("Tarifa 16% sobre (002+011) calibrada con tarjetón real 2A-AGO-2026; verificar incompatibilidades por retardos.")
    if (anchor && eligible) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "033",
      name: "Estímulo por Puntualidad",
      type: "earning",
      nature: "derived",
      amount: resolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "empirically_verified",
      elegibilitySource: eligible ? "payslip_confirmed" : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Base: 002", expression: `002 = ${c002.toFixed(2)}`, value: c002 },
        { label: "Base: 011", expression: `011 = ${c011.toFixed(2)}`, value: c011 },
        { label: "Base total", expression: `${c002} + ${c011} = ${base}`, value: base },
        { label: "033 = base × 16%", expression: `${base} × 0.16 = ${formulaAmount} (truncado a centavos)`, value: formulaAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [
        { source: "CCT", title: "Estímulo por Puntualidad", reference: "Art. 93 del RIT", notes: "Base observada empíricamente: solo 002+011 (tarjetón 2A-AGO-2026)." },
      ],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
