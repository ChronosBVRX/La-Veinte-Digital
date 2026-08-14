import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getPercentageForConcept072 } from "../../data/institutional-percentage-tables"

/**
 * Ayuda para Libros no Médicos (072) — Apéndice F, Tabla numérica 07.
 *
 * El porcentaje se resuelve por categoría con coincidencia ESTRICTA
 * (categoryId → categoryCode → nombre exacto → alias). Si la categoría no
 * está en la tabla NO se aplica un 5% por defecto: se exige confirmación.
 */
export const concept072Rule: PayrollRule = {
  id: "072",
  version: "2.0.0",
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

    const resolution = getPercentageForConcept072({
      categoryId: ctx.category.categoryId,
      categoryCode: ctx.category.categoryCode,
      categoryName: ctx.category.categoryName,
    })
    const percentage = resolution.percentage

    const eligible = anchor ? true : (isRecurring || hasPayslipEvidence)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = percentage === null ? 0 : base * percentage

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
      warnings.push(
        "Categoría no autorizada en la tabla oficial (Apéndice F, Tabla 07) — se requiere confirmación; NO se aplica porcentaje por defecto."
      )
    } else {
      warnings.push(`Porcentaje según Apéndice F, Tabla 07: ${(percentage * 100).toFixed(1)}% (${resolution.role ?? "categoría"})`)
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
      percentage === null ? "requires_confirmation" :
      "medium"

    const concept: CalculatedPayrollConcept = {
      code: "072",
      name: "Ayuda para Libros no Médicos",
      type: "earning",
      nature: "derived",
      amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "institutional_catalog_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        ...(percentage === null
          ? [{ label: "Porcentaje", expression: "Sin porcentaje autorizado para esta categoría", value: 0 }]
          : [
              { label: "Porcentaje según tabla", expression: `${((percentage) * 100).toFixed(1)}% (${resolution.role ?? "n/a"})`, value: percentage },
              { label: "072 = base × porcentaje", expression: `${base} × ${percentage} = ${formulaAmount}`, value: formulaAmount },
            ]),
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [resolution.legalBasis],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
