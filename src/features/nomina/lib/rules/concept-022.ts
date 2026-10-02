import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { CLAUSE_63_BIS_C_DAYS } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { buildBaseForConcept } from "../repercussion-engine"
import { truncateCurrency } from "../money"

/** Días de la tabla contractual para los años COMPLETADOS; undefined si menor a 5. A partir de 40 años se consolida el tope de 270 días. */
export function seniorityEntitlementDays(completedYears: number): number | undefined {
  if (completedYears < 5) return undefined
  if (completedYears >= 40) return 270
  return CLAUSE_63_BIS_C_DAYS[completedYears]
}

/**
 * Ayuda de Renta por Antigüedad (022) — Cláusula 63 Bis, inciso c.
 *
 * ## Fórmula QUINCENAL vigente (procedimiento IMSS 1A32-003-001)
 *
 *   base   = repercusiones del concepto (002 + 011; en su caso 013/057/058/061)
 *   días   = tabla contractual por AÑOS COMPLETADOS (63 Bis c: 5→60 … 40+→270)
 *   factor = días ÷ 360
 *   022    = trunc2(base × factor)
 *
 * Calibrada con el tarjetón real 2A-AGO-2026: 14 años → 99 días →
 * trunc2(7172.41 × 99/360) = $1,972.41 ✓
 *
 * A partir de los 40 años cumplidos, la Cláusula 63 Bis inc. c y los procedimientos
 * de liquidación institucional alcanzan su techo consolidado continuo de 270 días.
 */
export const rule022: PayrollRule = {
  id: "022",
  version: "5.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011", "013", "057", "058", "061"],
  valuePersistence: "while_dependencies_unchanged",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const completedYears = Math.floor(ctx.seniority.years)

    // Base normativa del 022 según la matriz de repercusiones (002 + 011,
    // y en su caso 013 + 057 + 058 + 061); observado empíricamente 002+011.
    const baseResult = buildBaseForConcept("022", ctx.calculatedConcepts, ctx.period.endDate)
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const base = baseResult.baseAmount > 0 ? baseResult.baseAmount : c002

    const days = seniorityEntitlementDays(completedYears)
    const belowThreshold = completedYears < 5

    // Derecho determinado: <5 años no aplica; ≥5 produce fórmula (tope 270 días a partir de 40 años).
    const eligible = !belowThreshold
    const formulaComputable = days !== undefined && days > 0
    const formulaAmount =
      days !== undefined
        ? truncateCurrency((base * days) / 360)
        : 0

    const anchor = ctx.conceptAnchors.get("022")

    const DEPS = ["002", "011", "013", "057", "058", "061", "seniority"]
    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "022",
      ruleId: "022",
      anchor,
      formulaAmount,
      formulaComputable,
      eligibleNow: eligible,
      status,
      mode: ctx.mode,
      valuePersistence: "while_dependencies_unchanged",
      period: ctx.period,
    })

    const source = resolution.usedAnchor ? "last_payslip" : "contract_rule"

    const confidence: CalculatedPayrollConcept["confidence"] =
      !formulaComputable && !belowThreshold ? "requires_confirmation" :
      resolution.requiresConfirmation ? "requires_confirmation" :
      !resolution.usedAnchor && anchor ? "medium" :
      anchor ? "high" :
      eligible ? "medium" :
      "requires_confirmation"

    const warnings: string[] = [...resolution.warnings]
    if (belowThreshold) {
      warnings.push("Ayuda de Renta por Antigüedad requiere 5+ años de servicio cumplidos (Cláusula 63 Bis, inciso c)")
    }
    if (formulaComputable && days !== undefined) {
      warnings.push(`Factor ${days}/360 = ${(days / 360).toFixed(7)} según tabla 63 Bis c (${completedYears >= 40 ? "tope consolidado de 270 días a partir de 40 años" : `${completedYears} años cumplidos`}).`)
    }
    if (anchor && eligible && formulaComputable) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const concept: CalculatedPayrollConcept = {
      code: "022",
      name: "Ayuda de Renta por Antigüedad (Cláusula 63 Bis, inciso c)",
      type: "earning",
      nature: "seniority_based",
      amount: resolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "empirically_verified",
      elegibilitySource: eligible ? "contract_rule" : "unknown",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: baseResult.integratedConcepts.map((i) => ({ code: i.code, amount: i.amount })),
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Antigüedad cumplida", expression: `floor(${ctx.seniority.years}) = ${completedYears} años`, value: completedYears },
        { label: "Días según tabla 63 Bis c", expression: days !== undefined ? `${days} días` : "Sin entrada en la tabla", value: days ?? 0 },
        ...baseResult.integratedConcepts.map((i) => ({
          label: `Base: ${i.code}`,
          expression: `${i.code} = ${i.amount.toFixed(2)}${i.weight !== 1 ? ` (×${i.weight})` : ""}`,
          value: i.amount,
        })),
        {
          label: "Base total (repercusiones)",
          expression: `${baseResult.integratedConcepts.map((i) => i.code).join(" + ") || "002"} = ${base}`,
          value: base,
        },
        ...(days !== undefined
          ? [
              { label: "Factor de antigüedad", expression: `${days} ÷ 360 = ${(days / 360).toFixed(7)}`, value: days / 360 },
              { label: "022 = base × factor (truncado)", expression: `${base} × ${days}/360 = ${formulaAmount}`, value: formulaAmount },
            ]
          : [{ label: "Fórmula no computable", expression: "Antigüedad sin entrada en tabla — requiere confirmación", value: 0 }]),
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [
        {
          source: "CCT",
          title: "Ayuda de Renta por antigüedad",
          reference: "Cláusula 63 Bis, inciso c + Procedimiento IMSS 1A32-003-001",
          notes:
            "Percepción quincenal: base aplicable × factor (días de tabla ÷ 360), truncada a centavos. Calibrada con tarjetón real 2A-AGO-2026 (14 años = 99 días = $1,972.41). A partir de 40 años cumplidos se consolida el tope contractual continuo de 270 días.",
        },
      ],
      warnings,
    }
    return { concept, dependencies: ["002", "011", "013", "057", "058", "061"] }
  },
}
