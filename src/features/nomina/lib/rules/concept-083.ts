import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

type Concept083Variant = "psychology_clinical" | "nutrition_without_credentials" | "nutrition_with_credentials" | "social_work"

function select083Variant(ctx: PayrollRuleContext): {
  variantId: Concept083Variant
  percentage: number
} {
  const profile = ctx.profile
  const categoryName = (ctx.category.categoryName ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase()

  if (categoryName.includes("PSICOLOG") || categoryName.includes("PSIC CLINICA")) {
    return { variantId: "psychology_clinical", percentage: 0.03 }
  }

  if (categoryName.includes("NUTRICION") || categoryName.includes("DIETETICA") || categoryName.includes("NUTRIOLOG")) {
    const hasDegree = profile.facts.some((f) => f.key === "has_professional_degree" && f.value === true)
    const hasLicense = profile.facts.some((f) => f.key === "has_professional_license" && f.value === true)

    if (hasDegree && hasLicense) {
      return { variantId: "nutrition_with_credentials", percentage: 0.20 }
    }
    return { variantId: "nutrition_without_credentials", percentage: 0.05 }
  }

  if (categoryName.includes("TRABAJADOR SOCIAL") || categoryName.includes("TRAB SOCIAL")) {
    return { variantId: "social_work", percentage: 0.05 }
  }

  return { variantId: "social_work", percentage: 0.05 }
}

const VARIANT_NAMES: Record<Concept083Variant, string> = {
  psychology_clinical: "Psicología Clínica",
  nutrition_without_credentials: "Nutrición y Dietética (sin título/cédula)",
  nutrition_with_credentials: "Nutrición y Dietética (con título y cédula)",
  social_work: "Trabajo Social",
}

export const concept083Rule: PayrollRule = {
  id: "083",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const anchor = ctx.conceptAnchors.get("083")
    const { variantId, percentage } = select083Variant(ctx)

    const DEPS = ["002"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const formulaAmount = c002 * percentage

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
      name: VARIANT_NAMES[variantId],
      type: "earning",
      nature: "derived",
      amount,
      included: eligible,
      source,
      confidence: anchor || isRecurring ? "high" : "requires_confirmation",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : (eligible ? "formula_deduced" : "unknown"),
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        { label: `Variante: ${VARIANT_NAMES[variantId]}`, expression: `Porcentaje: ${(percentage * 100).toFixed(1)}%`, value: percentage },
        { label: "083 = 002 × porcentaje", expression: `${c002} × ${percentage} = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [          { label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Concepto 083", reference: "Cláusula aplicable del CCT según categoría" }],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
