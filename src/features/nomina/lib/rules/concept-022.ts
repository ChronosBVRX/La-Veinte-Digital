import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { CLAUSE_63_BIS_C_DAYS } from "../types"

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

    const concept: CalculatedPayrollConcept = {
      code: "022",
      name: "Ayuda de Renta por Antigüedad (Cláusula 63 Bis, inciso c)",
      type: "earning",
      nature: "seniority_based",
      amount: annualAmount,
      included: false,
      source: "contract_rule",
      confidence: "requires_confirmation",
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        { label: "Antigüedad cumplida", expression: `${completedYears} años`, value: completedYears },
        { label: "Días según tabla", expression: `${days} días`, value: days },
        { label: "Valor diario", expression: `002 / 15 = ${c002} / 15 = ${dailyValue}`, value: dailyValue },
        { label: "Importe anual", expression: `${dailyValue} x ${days} = ${annualAmount}`, value: annualAmount },
      ],
      legalBasis: [{ source: "CCT", title: "Ayuda de Renta por antigüedad", reference: "Cláusula 63 Bis, inciso c" }],
      warnings: [
        "Prestación anual — no reflejada como percepción quincenal recurrente",
        "Requiere confirmar fecha de pago y mecanismo de distribución en nómina",
      ],
    }
    return { concept, dependencies: ["002"] }
  },
}
