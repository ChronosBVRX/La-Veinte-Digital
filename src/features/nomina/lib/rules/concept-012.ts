import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { truncateCurrency } from "../money"

/**
 * Jornada Discontinua (012).
 *
 * CONTRATO DE ANCLA: elegibilidad por evidencia ACTUAL (recurrencia confirmada
 * o hecho de jornada discontinua en nombramiento, sin incompatibles); el ancla
 * NO otorga derecho. Dependencias idénticas → importe REAL comprobado.
 */
export const concept012Rule: PayrollRule = {
  id: "012",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  valuePersistence: "while_dependencies_unchanged",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const anchor = ctx.conceptAnchors.get("012")
    const hasFact = profile.facts.some(
      (f) => f.key === "has_discontinuous_schedule" && f.value === true
    )
    const inAppointment = profile.facts.some(
      (f) => f.key === "discontinuous_schedule_in_appointment" && f.value === true
    )
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "012" && rc.confirmed && rc.appearsNormally === true
    )
    const hasIncompatible013 = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "013" && rc.confirmed && rc.appearsNormally === true
    )
    const hasIncompatible057 = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "057" && rc.confirmed && rc.appearsNormally === true
    )

    const eligible =
      isRecurring ||
      (hasFact && inAppointment && !hasIncompatible013 && !hasIncompatible057)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = truncateCurrency(base * 0.15)

    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "012",
      ruleId: "012",
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
      isRecurring ? "high" : hasFact ? "medium" : "requires_confirmation"
    if (resolution.requiresConfirmation) confidence = "requires_confirmation"

    const warnings: string[] = [...resolution.warnings]
    if (!eligible) {
      warnings.push("Requiere jornada de 8 horas con interrupción formal de 1 hora o más")
    }
    if (hasIncompatible013) {
      warnings.push("Incompatible con concepto 013 (Sobresueldo médico)")
    }
    if (hasIncompatible057) {
      warnings.push("Incompatible con concepto 057 (Atención Integral Continua)")
    }
    if (anchor && eligible) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "012",
      name: "Jornada Discontinua",
      type: "earning",
      nature: "derived",
      amount: resolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "contract_verified",
      elegibilitySource: eligible ? (isRecurring ? "payslip_confirmed" : "formula_deduced") : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Base: 002", expression: `002 = ${c002.toFixed(2)}`, value: c002 },
        { label: "Base: 011", expression: `011 = ${c011.toFixed(2)}`, value: c011 },
        { label: "Base total", expression: `${c002} + ${c011} = ${base}`, value: base },
        { label: "012 = base × 15%", expression: `${base} × 0.15 = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Jornada Discontinua", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
