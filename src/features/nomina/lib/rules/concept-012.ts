import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { truncateCurrency } from "../money"

export const concept012Rule: PayrollRule = {
  id: "012",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
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
      anchor ? true :
      isRecurring ||
      (hasFact && inAppointment && !hasIncompatible013 && !hasIncompatible057)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = truncateCurrency(base * 0.15)

    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      eligible ? formulaAmount : 0,
      status,
      ctx.mode,
    )

    const formulaSource = isRecurring ? "last_payslip" : "contract_rule"
    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : formulaSource

    const warnings: string[] = [...resolutionWarnings]
    if (!eligible) {
      warnings.push("Requiere jornada de 8 horas con interrupción formal de 1 hora o más")
    }
    if (hasIncompatible013) {
      warnings.push("Incompatible con concepto 013 (Sobresueldo médico)")
    }
    if (hasIncompatible057) {
      warnings.push("Incompatible con concepto 057 (Atención Integral Continua)")
    }
    if (anchor) {
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
      amount,
      included: eligible,
      source,
      confidence: anchor || isRecurring ? "high" : hasFact ? "medium" : "requires_confirmation",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "012 = base × 15%", expression: `${base} × 0.15 = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Jornada Discontinua", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
