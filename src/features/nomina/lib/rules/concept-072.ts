import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getPercentageForCategory } from "../../data/concept-percentage-tables"

export const concept072Rule: PayrollRule = {
  id: "072",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const anchor = ctx.conceptAnchors.get("072")
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "072" && rc.confirmed && rc.appearsNormally === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_072_on_payslip" && f.value === true
    )

    const categoryName = ctx.category.categoryName ?? ""
    const percentage = getPercentageForCategory("concept_072_category_percentages", categoryName, ctx.category.categoryId)

    const eligible = anchor ? true : (isRecurring || hasPayslipEvidence)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const effectivePct = percentage ?? 0.05
    const formulaAmount = base * effectivePct

    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      eligible ? formulaAmount : 0,
      status,
      ctx.mode,
    )

    const formulaSource = (isRecurring || hasPayslipEvidence) ? "last_payslip" : "contract_rule"
    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : formulaSource

    const warnings: string[] = [...resolutionWarnings]
    if (percentage === null) {
      warnings.push("Porcentaje no determinado para esta categoría — usando 5% por defecto")
    }
    if (!eligible) {
      warnings.push("Requiere categoría autorizada o evidencia en tarjetón anterior")
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
      percentage !== null ? "medium" :
      "requires_confirmation"

    const concept: CalculatedPayrollConcept = {
      code: "072",
      name: "Ayuda para Libros no Médicos",
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
        { label: "Porcentaje según categoría", expression: `${(effectivePct * 100).toFixed(1)}% = ${effectivePct}`, value: effectivePct },
        { label: "072 = base × porcentaje", expression: `${base} × ${effectivePct} = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda para Libros no Médicos", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
