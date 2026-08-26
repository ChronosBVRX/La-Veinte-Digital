import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { truncateCurrency } from "../money"

/**
 * Docencia en Enfermería (058).
 *
 * CONTRATO DE ANCLA: elegibilidad por evidencia ACTUAL; el ancla NO otorga
 * derecho. Dependencias idénticas → importe REAL comprobado.
 */
export const concept058Rule: PayrollRule = {
  id: "058",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  valuePersistence: "while_dependencies_unchanged",
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

    const eligible = isRecurring || (hasFact && hasPayslipEvidence)

    const DEPS = ["002", "011"]

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const formulaAmount = truncateCurrency(base * 0.31)

    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "058",
      ruleId: "058",
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
      isRecurring || hasPayslipEvidence ? "high" : "medium"
    if (resolution.requiresConfirmation) confidence = "requires_confirmation"

    const warnings: string[] = [...resolution.warnings]
    if (!eligible) {
      warnings.push("Requiere actividad docente formal en Enfermería")
    }
    if (anchor && eligible) {
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
      amount: resolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "contract_verified",
      elegibilitySource: eligible ? (isRecurring || hasPayslipEvidence ? "payslip_confirmed" : "formula_deduced") : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Base: 002", expression: `002 = ${c002.toFixed(2)}`, value: c002 },
        { label: "Base: 011", expression: `011 = ${c011.toFixed(2)}`, value: c011 },
        { label: "Base total", expression: `${c002} + ${c011} = ${base}`, value: base },
        { label: "058 = base × 31%", expression: `${base} × 0.31 = ${formulaAmount}`, value: formulaAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [{ source: "CCT", title: "Docencia en Enfermería", reference: "Cláusula aplicable del CCT" }],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
