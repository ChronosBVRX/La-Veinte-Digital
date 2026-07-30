import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { getPercentageForCategory } from "../../data/concept-percentage-tables"

export const concept072Rule: PayrollRule = {
  id: "072",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "072" && rc.confirmed && rc.appearsNormally === true
    )
    const hasPayslipEvidence = profile.facts.some(
      (f) => f.key === "concept_072_on_payslip" && f.value === true
    )

    const categoryName = ctx.category.categoryName ?? ""
    const percentage = getPercentageForCategory("concept_072_category_percentages", categoryName, ctx.category.categoryId)

    const eligible = isRecurring || hasPayslipEvidence

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const effectivePct = percentage ?? 0.05
    const amount = base * effectivePct

    const confidence: "high" | "medium" | "low" | "requires_confirmation" =
      isRecurring ? "high" :
      hasPayslipEvidence ? "high" :
      percentage !== null ? "medium" :
      "requires_confirmation"

    const concept: CalculatedPayrollConcept = {
      code: "072",
      name: "Ayuda para Libros no Médicos",
      type: "earning",
      nature: "derived",
      amount: eligible ? amount : 0,
      included: eligible,
      source: isRecurring ? "last_payslip" : hasPayslipEvidence ? "last_payslip" : "contract_rule",
      confidence,
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "Porcentaje según categoría", expression: `${(effectivePct * 100).toFixed(1)}% = ${effectivePct}`, value: effectivePct },
        { label: "072 = base × porcentaje", expression: `${base} × ${effectivePct} = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda para Libros no Médicos", reference: "Cláusula aplicable del CCT" }],
      warnings: [
        ...(percentage === null ? ["Porcentaje no determinado para esta categoría — usando 5% por defecto"] : []),
        ...(eligible ? [] : ["Requiere categoría autorizada o evidencia en tarjetón anterior"]),
      ],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
