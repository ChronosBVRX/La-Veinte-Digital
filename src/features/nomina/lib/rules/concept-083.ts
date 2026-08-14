import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { getPercentageForConcept083, type PercentageResolution } from "../../data/institutional-percentage-tables"

/**
 * Sobresueldo por Investigación y Docencia (083) — Apéndice H, Tabla 67.
 *
 * El porcentaje se resuelve por categoría con coincidencia ESTRICTA. Se
 * eliminaron dos comportamientos incorrectos:
 *  - la elevación a 20% por tener título y cédula profesional, y
 *  - el fallback de 5% de Trabajo Social para categorías desconocidas.
 * Si la categoría no está en la tabla el resultado exige confirmación.
 */
export const concept083Rule: PayrollRule = {
  id: "083",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const anchor = ctx.conceptAnchors.get("083")

    const resolution: PercentageResolution = getPercentageForConcept083({
      categoryId: ctx.category.categoryId,
      categoryCode: ctx.category.categoryCode,
      categoryName: ctx.category.categoryName,
    })
    const percentage = resolution.percentage

    const DEPS = ["002"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const formulaAmount = percentage === null ? 0 : c002 * percentage

    const isRecurring = ctx.profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "083" && rc.confirmed && rc.appearsNormally === true
    )

    const eligible = anchor ? true : isRecurring

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
    if (percentage === null) {
      warnings.push(
        "Categoría no autorizada en la tabla oficial (Apéndice H, Tabla 67) — se requiere confirmación; NO se aplica porcentaje por defecto."
      )
    } else {
      warnings.push(`Porcentaje según Apéndice H, Tabla 67: ${(percentage * 100).toFixed(1)}% (${resolution.role ?? "categoría"})`)
    }
    if (!eligible) {
      warnings.push("Requiere confirmación de actividad profesional aplicable")
    }
    if (anchor) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "083",
      name: resolution.role ?? "Sobresueldo por Investigación y Docencia",
      type: "earning",
      nature: "derived",
      amount,
      included: eligible,
      source,
      confidence: anchor || isRecurring ? "high" : (percentage === null ? "requires_confirmation" : "requires_confirmation"),
      verificationStatus: "institutional_catalog_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        ...(percentage === null
          ? [{ label: "Porcentaje", expression: "Sin porcentaje autorizado para esta categoría", value: 0 }]
          : [
              { label: `Categoría: ${resolution.role ?? "n/a"}`, expression: `Porcentaje: ${(percentage * 100).toFixed(1)}%`, value: percentage },
              { label: "083 = 002 × porcentaje", expression: `${c002} × ${percentage} = ${formulaAmount}`, value: formulaAmount },
            ]),
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [resolution.legalBasis],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
