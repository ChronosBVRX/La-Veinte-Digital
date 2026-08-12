import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

export const concept058Rule: PayrollRule = {
  id: "058",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const anchor = ctx.conceptAnchors.get("058")
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "058" && rc.confirmed && rc.appearsNormally === true
    )
    const hasFact = profile.facts.some(
      (f) => f.key === "participates_in_teaching" && f.value === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_058_on_payslip" && f.value === true
    )

    const eligible = anchor ? true : (isRecurring || (hasFact && hasPayslipEvidence))

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = base * 0.31

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
      warnings.push("Requiere actividad docente formal en Enfermería")
    }
    if (anchor) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "058",
      name: "Docencia en Enfermería",
      type: "earning",
      nature: "derived",
      amount,
      included: eligible,
      source,
      confidence: anchor || isRecurring ? "high" : "medium",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "058 = base × 31%", expression: `${base} × 0.31 = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Docencia en Enfermería", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
