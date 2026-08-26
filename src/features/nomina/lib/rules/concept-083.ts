import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { truncateCurrency } from "../money"
import { getPercentageForConcept083, type PercentageResolution } from "../../data/institutional-percentage-tables"

/**
 * Sobresueldo por Investigación y Docencia (083) — Apéndice H, Tabla 67.
 *
 * El porcentaje se resuelve por categoría con coincidencia ESTRICTA. Se
 * eliminaron dos comportamientos incorrectos:
 *  - la elevación a 20% por tener título y cédula profesional, y
 *  - el fallback de 5% de Trabajo Social para categorías desconocidas.
 * Si la categoría no está en la tabla el resultado exige confirmación.
 *
 * CONTRATO DE ANCLA: elegibilidad por evidencia ACTUAL; el ancla NO otorga
 * derecho. Con porcentaje autorizado y dependencias idénticas se conserva el
 * importe REAL comprobado; sin porcentaje la regla no es computable y el
 * ancla solo se repite marcada para confirmación.
 */
export const concept083Rule: PayrollRule = {
  id: "083",
  version: "3.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  valuePersistence: "while_dependencies_unchanged",
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
    const formulaAmount = percentage === null ? 0 : truncateCurrency(c002 * percentage)

    const isRecurring = ctx.profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "083" && rc.confirmed && rc.appearsNormally === true
    )

    const eligible = isRecurring

    const status = dependenciesStatus(DEPS, ctx)
    const anchorResolution = resolveWithAnchor({
      conceptCode: "083",
      ruleId: "083",
      anchor,
      formulaAmount,
      formulaComputable: percentage !== null,
      eligibleNow: eligible,
      status,
      mode: ctx.mode,
      valuePersistence: "while_dependencies_unchanged",
      period: ctx.period,
    })

    const source = anchorResolution.usedAnchor ? "last_payslip" : "contract_rule"

    let confidence: CalculatedPayrollConcept["confidence"] =
      isRecurring ? "high" :
      percentage === null ? "requires_confirmation" :
      "medium"
    if (anchorResolution.requiresConfirmation) confidence = "requires_confirmation"

    const warnings: string[] = [...anchorResolution.warnings]
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
    if (anchor && eligible && percentage !== null) {
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
      amount: anchorResolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "institutional_catalog_verified",
      elegibilitySource: eligible ? (isRecurring ? "payslip_confirmed" : "formula_deduced") : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }],
      resolutionAudit: anchorResolution.audit,
      calculationSteps: [
        { label: "Base: 002", expression: `002 = ${c002.toFixed(2)}`, value: c002 },
        { label: "Base total", expression: `${c002}`, value: c002 },
        ...(percentage === null
          ? [{ label: "Porcentaje", expression: "Sin porcentaje autorizado para esta categoría", value: 0 }]
          : [
              { label: `Categoría: ${resolution.role ?? "n/a"}`, expression: `Porcentaje: ${(percentage * 100).toFixed(1)}%`, value: percentage },
              { label: "083 = base × porcentaje", expression: `${c002} × ${percentage} = ${formulaAmount}`, value: formulaAmount },
            ]),
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [resolution.legalBasis],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
