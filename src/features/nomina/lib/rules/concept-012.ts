import type { PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept, PayrollRule } from "../types"

export const concept012Rule: PayrollRule = {
  id: "012",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const profile = ctx.profile
    const hasFact = profile.facts.some(
      (f) => f.key === "has_discontinuous_schedule" && f.value === true
    )
    const inAppointment = profile.facts.some(
      (f) => f.key === "discontinuous_schedule_in_appointment" && f.value === true
    )
    const isRecurring = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "012" && rc.confirmed && rc.appearsNormally === true
    )

    const hasIncompatible013 = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "013" && rc.confirmed && rc.appearsNormally === true
    )
    const hasIncompatible057 = profile.recurringConcepts.some(
      (rc) => rc.conceptCode === "057" && rc.confirmed && rc.appearsNormally === true
    )

    const eligible =
      isRecurring ||
      (hasFact && inAppointment && !hasIncompatible013 && !hasIncompatible057)

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.15

    const concept: CalculatedPayrollConcept = {
      code: "012",
      name: "Jornada Discontinua",
      type: "earning",
      nature: "derived",
      amount: eligible ? amount : 0,
      included: eligible,
      source: isRecurring ? "last_payslip" : "contract_rule",
      confidence: isRecurring ? "high" : hasFact ? "medium" : "requires_confirmation",
      verificationStatus: "contract_verified",
      dependencies: [{ code: "002", amount: c002 }, { code: "011", amount: c011 }],
      calculationSteps: [
        { label: "Base", expression: `002 + 011 = ${c002} + ${c011} = ${base}`, value: base },
        { label: "012 = base × 15%", expression: `${base} × 0.15 = ${amount}`, value: amount },
      ],
      legalBasis: [{ source: "CCT", title: "Jornada Discontinua", reference: "Cláusula aplicable del CCT" }],
      warnings: [
        ...(eligible ? [] : ["Requiere jornada de 8 horas con interrupción formal de 1 hora o más"]),
        ...(hasIncompatible013 ? ["Incompatible con concepto 013 (Sobresueldo médico)"] : []),
        ...(hasIncompatible057 ? ["Incompatible con concepto 057 (Atención Integral Continua)"] : []),
      ],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}
