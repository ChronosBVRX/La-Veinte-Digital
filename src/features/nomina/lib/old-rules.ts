import type {
  PayrollRuleContext, RuleCalculationResult, CalculatedPayrollConcept,
  PayrollRule, CalculationStep, LegalBasis,
} from "./types"
import { CLAUSE_63_BIS_C_DAYS } from "./types"

function step(label: string, expression: string, value: number): CalculationStep {
  return { label, expression, value }
}

function legalBasisCCT(
  title: string,
  reference: string,
  notes?: string
): LegalBasis {
  return { source: "CCT", title, reference, notes }
}

function legalBasisReconstructed(title: string, reference: string, notes?: string): LegalBasis {
  return { source: "reconstructed_application", title, reference, notes }
}

const commonLegalBasis: LegalBasis[] = [
  { source: "CCT", title: "Tabulador de sueldos", reference: "Tabla salarial vigente SNTSS" },
]

/* ---------- 002: SUELDO BASE ---------- */
export const rule002: PayrollRule = {
  id: "002",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const amount = ctx.category.biweeklyBaseSalary
    void ctx
    const concept: CalculatedPayrollConcept = {
      code: "002",
      name: "Sueldo Base Fijo",
      type: "earning",
      nature: "base",
      amount,
      included: true,
      source: "salary_table",
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource: "tabular_value",
      dependencies: [],
      calculationSteps: [step("Sueldo tabular quincenal", `${ctx.category.biweeklyBaseSalary}`, amount)],
      legalBasis: commonLegalBasis,
      warnings: [],
    }
    return { concept, dependencies: [] }
  },
}

/* ---------- 011: AYUDA DE RENTA INCISO B ---------- */
export const rule011: PayrollRule = {
  id: "011",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const amount = c002 * 0.8215
    const concept: CalculatedPayrollConcept = {
      code: "011",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso b)",
      type: "earning",
      nature: "derived",
      amount,
      included: true,
      source: "contract_rule",
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource: "formula_deduced",
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        step("002 del tabulador", `002 = ${c002}`, c002),
        step("011 = 002 × 0.8215", `${c002} × 0.8215 = ${amount}`, amount),
      ],
      legalBasis: [legalBasisCCT("Ayuda de Renta, inciso b", "Cláusula 63 Bis, inciso b")],
      warnings: [],
    }
    return { concept, dependencies: ["002"] }
  },
}

/* ---------- 020: AYUDA DE RENTA INCISO A ---------- */
export const rule020: PayrollRule = {
  id: "020",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(_ctx: PayrollRuleContext): RuleCalculationResult {
    void _ctx
    const paidFraction = 1
    const amount = 250 * paidFraction
    const concept: CalculatedPayrollConcept = {
      code: "020",
      name: "Ayuda de Renta (Cláusula 63 Bis, inciso a)",
      type: "earning",
      nature: "fixed",
      amount,
      included: true,
      source: "contract_rule",
      confidence: "high",
      verificationStatus: "contract_verified",
      elegibilitySource: "contract_rule",
      dependencies: [],
      calculationSteps: [
        step("Monto mensual CCT", "$500 mensuales", 500),
        step("Quincena ordinaria", "$500 ÷ 2 = $250", amount),
      ],
      legalBasis: [legalBasisCCT("Ayuda de Renta, inciso a", "Cláusula 63 Bis, inciso a", "$500 mensuales")],
      warnings: [],
    }
    return { concept, dependencies: [] }
  },
}

/* ---------- 022: AYUDA DE RENTA POR ANTIGUEDAD (INCISO C) ---------- */
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
    const annualAmount = dailyValue * days

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
      elegibilitySource: "formula_deduced",
      dependencies: [{ code: "002", amount: c002 }],
      calculationSteps: [
        step("Antigüedad cumplida", `${completedYears} años`, completedYears),
        step("Días según tabla", `${days} días`, days),
        step("Valor diario", `002 ÷ 15 = ${c002} ÷ 15 = ${dailyValue}`, dailyValue),
        step("Importe anual", `${dailyValue} × ${days} = ${annualAmount}`, annualAmount),
      ],
      legalBasis: [legalBasisCCT("Ayuda de Renta por antigüedad", "Cláusula 63 Bis, inciso c")],
      warnings: [
        "Prestación anual — no reflejada como percepción quincenal recurrente",
        "Requiere confirmar fecha de pago y mecanismo de distribución en nómina",
      ],
    }
    return { concept, dependencies: ["002"] }
  },
}

/* ---------- 054: EMANACIONES RADIACTIVAS NO MEDICAS ---------- */
export const rule054: PayrollRule = {
  id: "054",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const hasCondition = ctx.profile.occupationalConditions.some(
      (c) => c.type === "radiation_non_medical" && c.enabled && c.permanentExposure
    )

    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const amount = base * 0.20
    const warnings: string[] = []

    if (!hasCondition) {
      warnings.push("No se cumple la condición de exposición constante y permanente a emanaciones radiactivas no médicas")
    }

    const concept: CalculatedPayrollConcept = {
      code: "054",
      name: "Emanaciones Radiactivas no Médicas",
      type: "earning",
      nature: "derived",
      amount: hasCondition ? amount : 0,
      included: hasCondition,
      source: "contract_rule",
      confidence: hasCondition ? "high" : "medium",
      verificationStatus: "contract_verified",
      elegibilitySource: "formula_deduced",
      dependencies: [
        { code: "002", amount: c002 },
        { code: "011", amount: c011 },
      ],
      calculationSteps: [
        step("Base", `002 + 011 = ${c002} + ${c011} = ${base}`, base),
        step("20% sobre base", `${base} × 0.20 = ${amount}`, amount),
      ],
      legalBasis: [legalBasisCCT("Emanaciones Radiactivas no Médicas", "Cláusula aplicable del CCT")],
      warnings,
    }
    return { concept, dependencies: ["002", "011"] }
  },
}

/* ---------- 055: FONDO DE AHORRO ---------- */
export const rule055: PayrollRule = {
  id: "055",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: ["002", "011"],
  calculate(ctx: PayrollRuleContext): RuleCalculationResult {
    const c002 = ctx.calculatedConcepts.get("002")?.amount ?? 0
    const c011 = ctx.calculatedConcepts.get("011")?.amount ?? 0
    const base = c002 + c011
    const dailyValue = base / 15
    const fullAmount = dailyValue * 46

    const concept: CalculatedPayrollConcept = {
      code: "055",
      name: "Fondo de Ahorro",
      type: "earning",
      nature: "periodic",
      amount: fullAmount,
      included: false,
      source: "reconstructed_rule",
      confidence: "medium",
      verificationStatus: "app_reconstructed",
      elegibilitySource: "formula_deduced",
      dependencies: [
        { code: "002", amount: c002 },
        { code: "011", amount: c011 },
      ],
      calculationSteps: [
        step("Base", `002 + 011 = ${base}`, base),
        step("Valor diario", `${base} ÷ 15 = ${dailyValue}`, dailyValue),
        step("Importe completo", `${dailyValue} × 46 = ${fullAmount}`, fullAmount),
      ],
      legalBasis: [legalBasisReconstructed("Fondo de Ahorro", "Reconstruido de aplicación de referencia")],
      warnings: [
        "Fórmula reconstruida de la aplicación de referencia — pendiente de validación normativa",
        "Corresponde a la segunda quincena de julio — no aplicar en quincenas ordinarias",
      ],
    }
    return { concept, dependencies: ["002", "011"] }
  },
}

/* ---------- 050: AYUDA PARA DESPENSA ---------- */
export const rule050: PayrollRule = {
  id: "050",
  version: "1.0.0",
  effectiveFrom: "2025-01-01",
  dependencies: [],
  calculate(_ctx: PayrollRuleContext): RuleCalculationResult {
    void _ctx
    const amount = 0
    const concept: CalculatedPayrollConcept = {
      code: "050",
      name: "Ayuda para Despensa",
      type: "earning",
      nature: "fixed",
      amount,
      included: false,
      source: "contract_rule",
      confidence: "requires_confirmation",
      verificationStatus: "pending_validation",
      elegibilitySource: "unknown",
      dependencies: [],
      calculationSteps: [step("Monto pendiente de configuración", "Sin monto configurado en el catálogo", 0)],
      legalBasis: [legalBasisCCT("Ayuda para Despensa", "Prestación del CCT")],
      warnings: ["Requiere monto contractual configurado en el catálogo"],
    }
    return { concept, dependencies: [] }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGADO — Interpretación ANUAL del 022 (REFUTADA empíricamente)
//
// El tarjetón real 2A-AGO-2026 muestra el 022 como percepción QUINCENAL
// (trunc2((002+011) × 27.5%) = $1,972.41), no como acumulado anual de días.
// Se preserva esta implementación por su valor documental: la tabla
// CLAUSE_63_BIS_C_DAYS podría corresponder a una prestación anual SEPARADA
// que requiere revisión documental antes de descartarse. NUNCA usar para
// proyección quincenal sin evidencia nueva.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Refutada por tarjetón 2A-AGO-2026. Ver rules/concept-022.ts.
 */
export function calculateAnnualSeniorityEntitlement(input: {
  base: number
  completedYears: number
}): { days: number; annualAmount: number } {
  const days = input.completedYears < 5 ? 0 : (CLAUSE_63_BIS_C_DAYS[input.completedYears] ?? 270)
  const dailyValue = input.base / 15
  const annualAmount = Math.round((dailyValue * days + Number.EPSILON) * 100) / 100
  return { days, annualAmount }
}

/**
 * @deprecated Refutada por tarjetón 2A-AGO-2026. Ver rules/concept-022.ts.
 */
export function calculateBiweeklySeniorityComponent(input: {
  annualAmount: number
  totalPaychecks?: number
}): { biweeklyComponent: number; totalPaychecks: number; pendingValidation: true } {
  const totalPaychecks = input.totalPaychecks ?? 24
  return {
    biweeklyComponent: Math.round((input.annualAmount / totalPaychecks + Number.EPSILON) * 100) / 100,
    totalPaychecks,
    pendingValidation: true,
  }
}
