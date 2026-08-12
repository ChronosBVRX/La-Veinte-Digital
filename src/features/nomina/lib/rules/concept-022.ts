import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { CLAUSE_63_BIS_C_DAYS } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export const rule022: PayrollRule = {
  id: "022",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const completedYears = ctx.seniority.years
    const days = completedYears < 5 ? 0 : (CLAUSE_63_BIS_C_DAYS[completedYears] ?? 270)
    const dailyValue = c002 / 15
    const annualAmount = round2(dailyValue * days)

    const anchor = ctx.conceptAnchors.get("022")

    const DEPS = ["seniority"]
    const status = dependenciesStatus(DEPS, ctx)
    const { amount, warnings: resolutionWarnings } = resolveWithAnchor(
      anchor,
      annualAmount,
      status,
      ctx.mode,
    )

    const source =
      (anchor && (
        ctx.mode === "baseline" ||
        status === "unchanged" ||
        (status === "unknown" && ctx.mode !== "exploratory")
      )) ? "last_payslip" : "contract_rule"

    const warnings: string[] = [
      "Prestación anual — no reflejada como percepción quincenal recurrente",
      "Requiere confirmar fecha de pago y mecanismo de distribución en nómina",
      ...resolutionWarnings,
    ]
    if (anchor) {
      const discrepancy = Math.abs(annualAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${annualAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "022",
      name: "Ayuda de Renta por Antigüedad (Cláusula 63 Bis, inciso c)",
      type: "earning",
      nature: "seniority_based",
      amount,
      included: false,
      source,
      confidence: "requires_confirmation",
      verificationStatus: "contract_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : "formula_deduced",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        { label: "Antigüedad cumplida", expression: `${completedYears} años`, value: completedYears },
        { label: "Días según tabla", expression: `${days} días`, value: days },
        { label: "Valor diario", expression: `002 / 15 = ${c002} / 15 = ${dailyValue}`, value: dailyValue },
        { label: "Importe anual", expression: `${dailyValue} x ${days} = ${annualAmount}`, value: annualAmount },
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta por antigüedad", reference: "Cláusula 63 Bis, inciso c" }],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
