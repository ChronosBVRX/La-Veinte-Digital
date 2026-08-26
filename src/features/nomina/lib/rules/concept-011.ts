import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { anchorCoversPeriod } from "../engine"

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/**
 * Ayuda de Renta (011). Prioridad documental: valor TABULAR del catálogo
 * sobre la fórmula reconstruida; el ancla solo reproduce el tarjetón en
 * `baseline` sobre el MISMO periodo (contrato de anclas).
 */
export const rule011: PayrollRule = {
  id: "011",
  version: "2.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const formulaAmount = round2(c002 * 0.8215)
    const catalog011 = ctx.category.conceptoTabular011
    const anchor = ctx.conceptAnchors.get("011")
    const warnings: string[] = []

    let amount: number
    let source: CalculatedPayrollConcept["source"]
    let elegibilitySource: CalculatedPayrollConcept["elegibilitySource"]

    if (ctx.mode === "baseline" && anchor && anchorCoversPeriod(anchor, ctx.period)) {
      amount = anchor.amount
      source = "last_payslip"
      elegibilitySource = "payslip_confirmed"
    } else if (catalog011 !== undefined && catalog011 > 0) {
      amount = catalog011
      source = "salary_table"
      elegibilitySource = "tabular_value"
      if (anchor && Math.abs(anchor.amount - amount) > 1) {
        warnings.push(
          `Importe real del último tarjetón (${anchor.amount.toFixed(2)}) difiere del tabular vigente (${amount.toFixed(2)}).`
        )
      }
    } else {
      amount = formulaAmount
      source = "contract_rule"
      elegibilitySource = "formula_deduced"
      if (anchor && Math.abs(anchor.amount - amount) > 1) {
        warnings.push(
          `Importe real del último tarjetón (${anchor.amount.toFixed(2)}) difiere de la fórmula 002 × 82.15% (${amount.toFixed(2)}).`
        )
      }
    }

    const steps: CalculatedPayrollConcept["calculationSteps"] = [
      { label: "002 del tabulador", expression: `002 = ${c002}`, value: c002 },
      { label: "011 = 002 x 82.15% (fórmula CCT)", expression: `${c002} x 0.8215 = ${formulaAmount}`, value: formulaAmount },
    ]
    if (catalog011 !== undefined && catalog011 > 0) {
      steps.push({ label: "Valor tabular vigente (catálogo)", expression: `Catálogo: ${catalog011}`, value: catalog011 })
    }
    if (anchor) {
      steps.push({ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount })
    }

    const concept: CalculatedPayrollConcept = {
      code: "011",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso b)",
      type: "earning",
      nature: "derived",
      amount,
      included: true,
      source,
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource,
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: steps,
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta, inciso b", reference: "Cláusula 63 Bis, inciso b" }],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
