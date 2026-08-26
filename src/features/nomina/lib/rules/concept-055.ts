import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { buildBaseForConcept } from "../repercussion-engine"
import { calculateFondoAhorro, FONDO_AHORRO_CONSTANTS } from "@/shared/lib/fondo-ahorro"

/**
 * Fondo de Ahorro (055) — régimen ordinario.
 *
 * Base = sueldo tabular (002), excluye la prima 011 (p. 1A74-003-024).
 * Importe = (002 ÷ 15 × 46) × (unidades ÷ 360); se paga en la 2ª quincena de
 * julio. Si no hay unidades confirmadas se presenta el escenario de año
 * completo como supuesto (requires_confirmation). El 022 (ayuda de renta
 * anual) nunca integra esta base.
 *
 * CONTRATO DE ANCLA: la elegibilidad depende ÚNICAMENTE de la ventana de pago
 * (2ª quincena de julio). Que exista un ancla de un julio anterior NO hace
 * que exista julio ahora; el ancla solo verifica/calibra el importe dentro
 * de la ventana. Fuera de la ventana el importe es 0 y el concepto queda
 * excluido, con auditoría de la decisión.
 */
export const rule055: PayrollRule = {
  id: "055",
  version: "3.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  valuePersistence: "replay_only",
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const anchor = ctx.conceptAnchors.get("055")

    // Base normativa: solo 002 repercute en 055 según el procedimiento.
    const baseResult = buildBaseForConcept("055", ctx.calculatedConcepts, ctx.period.endDate)
    const base = baseResult.baseAmount > 0 ? baseResult.baseAmount : c002

    const confirmedUnits = ctx.profile.fondoAhorro?.unidades
    const derivation = calculateFondoAhorro({
      sueldoTabular: base,
      unidades: confirmedUnits,
      regime: ctx.profile.fondoAhorro?.regime ?? "ordinario",
    })
    const formulaAmount = derivation.importeReal
    const fullAmount = derivation.fullAmount

    const isJulySecondHalf =
      ctx.period.month === FONDO_AHORRO_CONSTANTS.MONTH_PAYMENT &&
      ctx.period.half === FONDO_AHORRO_CONSTANTS.HALF_PAYMENT

    const eligible = isJulySecondHalf

    const DEPS = ["002"]
    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "055",
      ruleId: "055",
      anchor,
      formulaAmount,
      formulaComputable: true,
      eligibleNow: eligible,
      status,
      mode: ctx.mode,
      valuePersistence: "replay_only",
      period: ctx.period,
    })

    const source = resolution.usedAnchor ? "last_payslip" : "regulation_rule"

    const warnings: string[] = [
      ...derivation.warnings,
      ...resolution.warnings,
      ...(eligible
        ? []
        : ["Corresponde a la segunda quincena de julio — no aplica en esta quincena"]),
    ]
    if (anchor && eligible) {
      const discrepancy = Math.abs(formulaAmount - anchor.amount)
      if (discrepancy > 0.50) {
        warnings.push(`Diferencia entre fórmula (${formulaAmount.toFixed(2)}) y último tarjetón (${anchor.amount.toFixed(2)}): ${discrepancy.toFixed(2)}`)
      }
    }

    const confidence: "high" | "medium" | "low" | "requires_confirmation" =
      !eligible ? "low" :
      resolution.requiresConfirmation ? "requires_confirmation" :
      anchor ? "high" :
      derivation.requiresConfirmation ? "requires_confirmation" :
      "medium"

    const concept: CalculatedPayrollConcept = {
      code: "055",
      name: "Fondo de Ahorro",
      type: "earning",
      nature: "periodic",
      amount: resolution.amount,
      included: eligible,
      source,
      confidence,
      verificationStatus: "regulation_verified",
      elegibilitySource: anchor ? "payslip_confirmed" : "contract_rule",
      anchorAmount: anchor?.amount,
      anchorDate: anchor?.date,
      dependencies: [{ code: "002", amount: base }],
      resolutionAudit: resolution.audit,
      calculationSteps: [
        { label: "Base (régimen ordinario)", expression: `002 (sueldo tabular) = ${base}`, value: base },
        { label: "Valor diario", expression: `${base} ÷ 15 = ${derivation.dailyValue}`, value: derivation.dailyValue },
        { label: "Importe completo (46 días)", expression: `${derivation.dailyValue} × 46 = ${fullAmount}`, value: fullAmount },
        { label: "Unidades computables", expression: `${derivation.unidades} ÷ 360 = ${derivation.proporcion}`, value: derivation.proporcion },
        { label: "Importe del periodo", expression: `${fullAmount} × ${derivation.proporcion} = ${formulaAmount}`, value: formulaAmount },
        { label: "Ventana de pago", expression: isJulySecondHalf ? "2ª quincena de julio → aplica" : "Fuera de la 2ª quincena de julio → no aplica", value: isJulySecondHalf ? 1 : 0 },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [derivation.legalBasis],
      warnings,
    }
    return { concept, dependencies: ["002"] }
  },
}
