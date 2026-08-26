import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"
import { dependenciesStatus, resolveWithAnchor } from "../engine"
import { buildBaseForConcept } from "../repercussion-engine"
import { truncateCurrency } from "../money"

/**
 * Ayuda de Renta por Antigüedad (022) — Cláusula 63 Bis, inciso c.
 *
 * ## Lectura QUINCENAL (vigente, calibrada con tarjetón real)
 *
 * El tarjetón real 2A-AGO-2026 (TÉCNICO RADIÓLOGO 80, 14 años de antigüedad,
 * 15 días pagados) muestra el 022 como percepción QUINCENAL recurrente:
 *
 *   base = 002 + 011 = 3,937.64 + 3,234.77 = 7,172.41
 *   022  = trunc2(7172.41 × 27.5%) = $1,972.41 ✓
 *
 * Esto REFUTA la interpretación anterior que trataba el 022 como un derecho
 * anual lump-sum (tabla de días × valor diario) y lo acumulaba en una sola
 * quincena — mecanismo que inflaba el total proyectado en decenas de miles.
 *
 * La tarifa 27.5% está calibrada con UN SOLO punto de observación (14 años).
 * Hasta contar con más tarjetones de distintas antigüedades se aplica plana
 * para antigüedad ≥ 5 años, con advertencia explícita. La implementación
 * anual previa se preservó en `old-rules.ts` para referencia documental.
 */
export const rule022: PayrollRule = {
  id: "022",
  version: "4.0.0",
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

    const RATE = 0.275 // calibrado empíricamente @ 14 años (tarjetón 2A-AGO-2026)
    const eligible = completedYears >= 5
    const formulaAmount = truncateCurrency(base * RATE)

    const anchor = ctx.conceptAnchors.get("022")

    const DEPS = ["002", "011", "013", "057", "058", "061", "seniority"]
    const status = dependenciesStatus(DEPS, ctx)
    const resolution = resolveWithAnchor({
      conceptCode: "022",
      ruleId: "022",
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
      anchor ? "high" : eligible ? "medium" : "requires_confirmation"
    if (resolution.requiresConfirmation) confidence = "requires_confirmation"

    const warnings: string[] = [
      ...resolution.warnings,
      "Tarifa 27.5% calibrada con un solo tarjetón (14 años, 2A-AGO-2026): pendiente validar si escala por antigüedad.",
    ]
    if (!eligible) {
      warnings.push("Ayuda de Renta por Antigüedad requiere 5+ años de servicio (Cláusula 63 Bis, inciso c)")
    }
    if (anchor && eligible) {
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
        { label: "Antigüedad cumplida", expression: `${completedYears} años`, value: completedYears },
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
        { label: "022 = base × 27.5%", expression: `${base} × 0.275 = ${formulaAmount} (truncado a centavos)`, value: formulaAmount },
        ...(anchor ? [{ label: "Último tarjetón (referencia)", expression: `Ancla: ${anchor.amount}`, value: anchor.amount }] : []),
      ],
      legalBasis: [
        {
          source: "CCT",
          title: "Ayuda de Renta por antigüedad",
          reference: "Cláusula 63 Bis, inciso c",
          notes:
            "Percepción quincenal confirmada en tarjetón real 2A-AGO-2026. La lectura anual lump-sum previa quedó refutada; ver old-rules.ts.",
        },
      ],
      warnings,
    }
    return { concept, dependencies: ["002", "011", "013", "057", "058", "061"] }
  },
}
