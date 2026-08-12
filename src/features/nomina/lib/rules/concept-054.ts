import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

export const rule054: PayrollRule = {
  id: "054",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const anchor = ctx.conceptAnchors.get("054")
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "054" && rc.confirmed && rc.appearsNormally === true
    )
    const hasCondition = profile.occupationalConditions.some(
      (c) => c.type === "radiation_non_medical" && c.enabled && c.permanentExposure
    )
    const hasFact = profile.facts.some(
      (f) => f.key === "permanent_radiation_exposure" && f.value === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_054_on_payslip" && f.value === true
    )

    const eligible = anchor ? true : (isRecurring || hasCondition || hasFact || hasPayslipEvidence)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = base * 0.20

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
      warnings.push("No se ha confirmado exposición constante y permanente a emanaciones radiactivas no médicas")
    }
    if (anchor) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const confidence: "high" | "medium" | "low" | "requires_confirmation" =
      anchor ? "high" :
      isRecurring ? "high" :
      hasPayslipEvidence ? "high" :
      eligible ? "medium" :
      "requires_confirmation"

    const concept: CalculatedPayrollConcept = {
      code: "054",
      name: "Emanaciones Radiactivas no Médicas",
      type: "earning",
      nature: "derived",
      amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "20% sobre base", expression: `${base} × 0.20 = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Emanaciones Radiactivas no Médicas", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
