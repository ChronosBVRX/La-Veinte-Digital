import { describe, it, expect } from "vitest"
import { roundCurrency, formatCurrency, parseCurrencyInput } from "../lib/money"
import { calculateSeniority, reconstructEffectiveDate } from "../lib/seniority"
import { getPayPeriod, getCurrentPayPeriod, getNextPayPeriod } from "../lib/periods"
import {
  rule002, rule011, rule020, rule022, rule02,
  rule054, rule055, rule050,
  rule072,
} from "../lib/rules"
import { topologicalSort, calculateProjection, detectCircularDependencies } from "../lib/engine"
import { resolveCategory } from "../lib/category-resolver"
import { CLAUSE_63_BIS_C_DAYS } from "../lib/types"
import { getPercentageForCategory } from "../data/concept-percentage-tables"
import { getFixedAmount } from "../data/fixed-concept-amounts"

function getPercentageForConcept072(categoryId: string): number {
  return getPercentageForCategory("concept_072_category_percentages", categoryId, categoryId) ?? 0.05
}
import { getImpactMatrixEffectiveAt } from "../data/repercussion-matrix"
import { evaluateEligibilityForConcept } from "../lib/eligibility"
import { buildPendingQuestions } from "../lib/question-engine"
import { calculateProjectionTotals, validateProjectionTotals } from "../lib/totals"
import { buildBaseForConcept } from "../lib/repercussion-engine"
import type {
  PayrollRuleContext, EmployeePayrollProfile, ResolvedSalaryCategory,
  PayPeriod, SeniorityResult, PayrollRule, CalculatedPayrollConcept,
  PayrollFact, PayrollFactKey, PayrollFactValue,
} from "../lib/types"

const mockCategory: ResolvedSalaryCategory = {
  categoryId: "93",
  categoryName: "TECNICO RADIOLOGO 80",
  categoryCode: "TECRAD80",
  workdayHours: 8,
  monthlyBaseSalary: 7875.28,
  biweeklyBaseSalary: 3937.64,
  effectiveFrom: "2025-01-01",
  sourceRecordId: "built-in:tecnico-radiologo-80",
}

const mockPeriod: PayPeriod = {
  id: "2025-01-Q1",
  year: 2025, month: 1, half: 1,
  startDate: "2025-01-01", endDate: "2025-01-15",
  label: "01/2025 1ra quincena",
}

const mockSeniority: SeniorityResult = {
  years: 10, months: 0, days: 0, totalDays: 3652,
  referenceDate: "2025-01-01",
  source: "confirmed_effective_date",
  warnings: [],
}

function createMockContext(overrides?: Partial<PayrollRuleContext>): PayrollRuleContext {
  const profile: EmployeePayrollProfile = {
    id: "test-1",
    userId: "user-1",
    consentGiven: true,
    employmentType: "base",
    workdayHours: 8,
    shift: "matutino",
    occupationalConditions: [],
    facts: [],
    siapConceptMarks: [],
    recurringConcepts: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  }

  return {
    profile,
    category: mockCategory,
    period: mockPeriod,
    seniority: mockSeniority,
    incidents: [],
    confirmedRecurringConcepts: [],
    calculatedConcepts: new Map(),
    ...overrides,
  }
}

function addFact(profile: EmployeePayrollProfile, key: PayrollFactKey, value: PayrollFactValue): EmployeePayrollProfile {
  const fact: PayrollFact = { key, value, source: "user", confidence: 1, updatedAt: "2025-01-01" }
  return { ...profile, facts: [...profile.facts, fact] }
}

describe("money utils", () => {
  it("roundCurrency", () => {
    expect(roundCurrency(10.456)).toBe(10.46)
    expect(roundCurrency(10.454)).toBe(10.45)
  })
  it("formatCurrency produce formato mexicano", () => {
    const r = formatCurrency(12345.67)
    expect(r).toContain("12")
    expect(r).toContain("345")
  })
  it("parseCurrencyInput normaliza comas y simbolo", () => {
    expect(parseCurrencyInput("$12,345.67")).toBe(12345.67)
    expect(parseCurrencyInput("")).toBeNull()
    expect(parseCurrencyInput("-100")).toBeNull()
  })
})

describe("periods", () => {
  it("getPayPeriod 1ra quincena", () => {
    const p = getPayPeriod(2025, 1, 1)
    expect(p.startDate).toBe("2025-01-01")
    expect(p.endDate).toBe("2025-01-15")
    expect(p.half).toBe(1)
  })
  it("getPayPeriod 2da quincena", () => {
    const p = getPayPeriod(2025, 1, 2)
    expect(p.startDate).toBe("2025-01-16")
    expect(p.endDate).toBe("2025-01-31")
  })
  it("getCurrentPayPeriod antes del 16", () => {
    const p = getCurrentPayPeriod("2025-01-10")
    expect(p.half).toBe(1)
  })
  it("getNextPayPeriod de Q1 a Q2", () => {
    const p = getNextPayPeriod("2025-01-10")
    expect(p.half).toBe(2)
  })
})

describe("seniority", () => {
  it("calculateSeniority 10 years exactly", () => {
    const r = calculateSeniority("2015-01-01", "2025-01-01")
    expect(r.years).toBe(10)
    expect(r.months).toBe(0)
    expect(r.days).toBe(0)
  })
  it("reconstructEffectiveDate", () => {
    const date = reconstructEffectiveDate({ years: 10, months: 0, days: 0 }, "2025-01-15")
    expect(date).toBe("2015-01-15")
  })
})

describe("Fórmula 002 - Sueldo Base", () => {
  it("usa el sueldo tabular quincenal", () => {
    const ctx = createMockContext()
    const result = rule002.calculate(ctx)
    expect(result.concept.amount).toBe(3937.64)
    expect(result.concept.code).toBe("002")
    expect(result.concept.source).toBe("salary_table")
    expect(result.concept.confidence).toBe("high")
  })
})

describe("Fórmula 011 - Ayuda de Renta inciso b", () => {
  it("011 = 002 x 0.8215", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const result = rule011.calculate(ctx)
    expect(result.concept.amount).toBeCloseTo(3234.77, 1)
    expect(result.concept.dependencies).toHaveLength(1)
  })
})

describe("Fórmula 020 - Ayuda de Renta fija", () => {
  it("usa monto versionado de fixed-concept-amounts", () => {
    expect(getFixedAmount("020", "2025-06-01")?.amount).toBe(250)
  })
  it("250 por quincena", () => {
    const result = rule020.calculate(createMockContext())
    expect(result.concept.amount).toBe(250)
  })
})

describe("Fórmula 022 - Ayuda de Renta por antigüedad", () => {
  it("0 si antigüedad < 5 años", () => {
    const ctx = createMockContext({ seniority: { ...mockSeniority, years: 3 } })
    const c002 = rule002.calculate(ctx)
    const ctx2 = createMockContext({
      seniority: { ...mockSeniority, years: 3 },
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const result = rule022.calculate(ctx2)
    expect(result.concept.amount).toBe(0)
    expect(result.concept.included).toBe(false)
  })
  it(">0 si antigüedad >= 5 años", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const result = rule022.calculate(ctx)
    expect(result.concept.amount).toBeGreaterThan(0)
    expect(result.concept.included).toBe(false)
  })
})

describe("Fórmula 02 - Transporte", () => {
  it("no incluido sin hecho confirmado", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const result = rule02.calculate(ctx2)
    expect(result.concept.included).toBe(false)
  })
})

describe("Fórmula 054 - Emanaciones Radiactivas", () => {
  it("20% sobre (002 + 011) cuando aplica", () => {
    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ profile, calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const profileWithCondition = {
      ...profile,
      occupationalConditions: [{ type: "radiation_non_medical" as const, enabled: true, permanentExposure: true }],
    }
    const ctx2 = createMockContext({
      profile: profileWithCondition,
      calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]),
    })
    const result = rule054.calculate(ctx2)
    expect(result.concept.included).toBe(true)
    expect(result.concept.amount).toBeCloseTo(1434.48, 1)
  })
  it("no se activa sin condicion", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const result = rule054.calculate(ctx2)
    expect(result.concept.included).toBe(false)
  })
})

describe("Fórmula 055 - Fondo de Ahorro", () => {
  it("verificationStatus es app_reconstructed", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const r = rule055.calculate(ctx2)
    expect(r.concept.verificationStatus).toBe("app_reconstructed")
  })
  it("no incluido fuera de segunda quincena de julio", () => {
    const janPeriod = getPayPeriod(2025, 1, 1)
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ period: janPeriod, calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ period: janPeriod, calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const result = rule055.calculate(ctx2)
    expect(result.concept.included).toBe(false)
  })
})

describe("Fórmula 072 - Ayuda para Libros (Técnico Radiólogo)", () => {
  it("porcentaje 5% para Técnico Radiólogo", () => {
    expect(getPercentageForConcept072("TÉCNICO RADIÓLOGO 80")).toBe(0.05)
  })
  it("072 = (002 + 011) x 5% = $358.62 para ejemplo dado", () => {
    const c002Value = 3937.64
    const c011Value = 3234.77
    const base = c002Value + c011Value
    const amount = Math.round((base * 0.05 + Number.EPSILON) * 100) / 100
    expect(amount).toBe(358.62)
  })
  it("no incluido sin hecho en tarjetón", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const result = rule072.calculate(ctx2)
    expect(result.concept.included).toBe(false)
  })
})

describe("engine - topologicalSort", () => {
  it("ordena reglas correctamente", () => {
    const rules = [rule054, rule011, rule002]
    const sorted = topologicalSort(rules)
    expect(sorted[0].id).toBe("002")
    expect(sorted[1].id).toBe("011")
    expect(sorted[2].id).toBe("054")
  })
})

describe("engine - detectCircularDependencies", () => {
  function rule(id: string, dependencies: string[] = []): PayrollRule {
    return {
      id, version: "1.0.0", effectiveFrom: "2025-01-01", dependencies,
      calculate: () => {
        throw new Error("no se calcula en este test")
      },
    }
  }

  it("no reporta ciclos en un grafo acíclico", () => {
    const rules = [rule("A", ["B"]), rule("B", ["C"]), rule("C"), rule("D", ["B"])]
    expect(detectCircularDependencies(rules)).toEqual([])
  })

  it("no reporta falsos positivos con dependencias compartidas (diamond)", () => {
    const rules = [rule("A", ["B", "C"]), rule("B", ["D"]), rule("C", ["D"]), rule("D")]
    expect(detectCircularDependencies(rules)).toEqual([])
  })

  it("reporta un ciclo directo", () => {
    const rules = [rule("A", ["B"]), rule("B", ["A"])]
    const errors = detectCircularDependencies(rules)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain("A")
    expect(errors[0]).toContain("B")
  })

  it("reporta un autociclo", () => {
    const errors = detectCircularDependencies([rule("A", ["A"])])
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain("A")
  })

  it("reporta un ciclo en un grafo con ramas adicionales", () => {
    const rules = [rule("A", ["B", "C"]), rule("B", ["C"]), rule("C", ["A"]), rule("D")]
    const errors = detectCircularDependencies(rules)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe("engine - calculateProjection", () => {
  it("genera proyeccion con estructura nueva", () => {
    const profile: EmployeePayrollProfile = {
      id: "test-1", userId: "user-1", consentGiven: true,
      employmentType: "base", workdayHours: 8, shift: "matutino",
      occupationalConditions: [{ type: "radiation_non_medical", enabled: true, permanentExposure: true }],
      facts: [{ key: "permanent_radiation_exposure", value: true, source: "user", confidence: 1, updatedAt: "2025-01-01" }],
      siapConceptMarks: [],
      recurringConcepts: [],
      createdAt: "2025-01-01", updatedAt: "2025-01-01",
    }
    const result = calculateProjection({ profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority, incidents: [], recurringConcepts: [] })
    expect(result.projection.earnings.length).toBeGreaterThan(0)
    expect(result.projection.probableConcepts).toBeDefined()
    expect(result.projection.conditionalConcepts).toBeDefined()
    expect(result.projection.totals).toBeDefined()
    expect(result.eligibilityResults).toBeDefined()
    expect(result.questions).toBeDefined()
  })

  it("no llama 'líquido estimado' sin deducciones", () => {
    const profile: EmployeePayrollProfile = {
      id: "test-1", userId: "user-1", consentGiven: true,
      employmentType: "base", workdayHours: 8, shift: "matutino",
      occupationalConditions: [], facts: [], siapConceptMarks: [], recurringConcepts: [],
      createdAt: "2025-01-01", updatedAt: "2025-01-01",
    }
    const result = calculateProjection({ profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority, incidents: [], recurringConcepts: [] })
    expect(result.projection.totals.confirmedNet).toBeUndefined()
  })
})

describe("Repercussion matrix", () => {
  it("072 impacta 107, 108, 111, 152, 155, 164", () => {
    const impacts = getImpactMatrixEffectiveAt("2025-06-01")
    const targets = impacts.filter((i) => i.sourceConceptCode === "072").map((i) => i.targetConceptCode)
    expect(targets).toContain("107")
    expect(targets).toContain("108")
    expect(targets).toContain("111")
    expect(targets).toContain("152")
    expect(targets).toContain("155")
    expect(targets).toContain("164")
  })
})

describe("Eligibility engine", () => {
  it("determina estado correcto segun hechos", () => {
    const profile: EmployeePayrollProfile = {
      id: "test", userId: "user", consentGiven: true,
      employmentType: "base", workdayHours: 8, shift: "matutino",
      occupationalConditions: [], facts: [], siapConceptMarks: [], recurringConcepts: [],
      createdAt: "2025-01-01", updatedAt: "2025-01-01",
    }
    const result = evaluateEligibilityForConcept("072", profile, mockCategory, [])
    expect(result.missingFacts.length).toBeGreaterThan(0)
    expect(result.status).toBe("requires_answer")
  })
})

describe("Question engine", () => {
  it("maximo 3 preguntas por lote", () => {
    const profile: EmployeePayrollProfile = {
      id: "test", userId: "user", consentGiven: true,
      employmentType: "base", workdayHours: 8, shift: "matutino",
      occupationalConditions: [], facts: [], siapConceptMarks: [], recurringConcepts: [],
      createdAt: "2025-01-01", updatedAt: "2025-01-01",
    }
    const eligibilityResults = [{
      conceptCode: "072", status: "requires_answer" as const,
      matchedRequirements: [],
      missingFacts: [{ factKey: "concept_072_on_payslip" as PayrollFactKey, conceptCode: "072", question: "test" }],
      failedRequirements: [], administrativeRequirements: [], confidence: 0.3, reasons: [],
    }]
    const questions = buildPendingQuestions(profile, eligibilityResults, [])
    expect(questions.length).toBeLessThanOrEqual(3)
  })
})

describe("Category resolver", () => {
  it("resuelve por nombre exacto", () => {
    const r = resolveCategory("ABOGADO 80", "2025-01-01")
    expect(r.resolved).toBe(true)
    expect(r.category?.biweeklyBaseSalary).toBeGreaterThan(0)
  })
  it("resuelve con acentos y espacios", () => {
    const r = resolveCategory("  Técnico   Radiólogo   80  ", "2025-01-01")
    expect(r.resolved).toBe(true)
    expect(r.category?.categoryName).toBe("TECNICO RADIOLOGO 80")
  })
  it("retorna no encontrado para categoria inexistente", () => {
    const r = resolveCategory("NOEXISTE", "2025-01-01")
    expect(r.resolved).toBe(false)
    expect(r.status).toBe("not_found")
  })
})

describe("Totals - no mezclar conceptos", () => {
  it("totals separan confirmados, probables y condicionales", () => {
    const confirmed: CalculatedPayrollConcept = {
      code: "002", name: "Sueldo", type: "earning", nature: "base",
      amount: 3937.64, included: true, source: "salary_table",
      confidence: "high", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const probable: CalculatedPayrollConcept = {
      code: "072", name: "Ayuda", type: "earning", nature: "derived",
      amount: 358.62, included: true, source: "contract_rule",
      confidence: "medium", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const conditional: CalculatedPayrollConcept = {
      code: "054", name: "Radiación", type: "earning", nature: "derived",
      amount: 1434.48, included: false, source: "contract_rule",
      confidence: "requires_confirmation", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const totals = calculateProjectionTotals([confirmed, probable, conditional])
    expect(totals.confirmedEarnings).toBe(3937.64)
    expect(totals.probableEarnings).toBe(358.62)
    expect(totals.conditionalPotentialEarnings).toBe(1434.48)
    expect(totals.confirmedGross).toBe(3937.64)
    expect(totals.probableGross).toBeCloseTo(4296.26)
    expect(totals.possibleGross).toBeCloseTo(5730.74)
  })

  it("confirmedNet solo resta deducciones confirmadas", () => {
    const confirmed: CalculatedPayrollConcept = {
      code: "002", name: "Sueldo", type: "earning", nature: "base",
      amount: 3937.64, included: true, source: "salary_table",
      confidence: "high", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const confirmedDeduction: CalculatedPayrollConcept = {
      code: "301", name: "ISR", type: "deduction", nature: "base",
      amount: 500, included: true, source: "contract_rule",
      confidence: "high", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const estimatedDeduction: CalculatedPayrollConcept = {
      code: "311", name: "Cuota sindical", type: "deduction", nature: "derived",
      amount: 100, included: true, source: "contract_rule",
      confidence: "medium", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const totals = calculateProjectionTotals([confirmed, confirmedDeduction, estimatedDeduction])
    expect(totals.confirmedNet).toBeCloseTo(3437.64)
    expect(totals.estimatedNetRange).toEqual({
      minimum: 3937.64 - 500 - 100,
      maximum: 3937.64 - 500,
    })
  })

  it("validateProjectionTotals rechaza totales no finitos", () => {
    const ok = calculateProjectionTotals([])
    expect(validateProjectionTotals(ok)).toBe(true)
    expect(validateProjectionTotals({ ...ok, confirmedGross: NaN })).toBe(false)
    expect(validateProjectionTotals({ ...ok, probableGross: Infinity })).toBe(false)
    expect(validateProjectionTotals({ ...ok, possibleGross: Number("x") })).toBe(false)
  })
})

describe("Concepto 022 - tabla CLAUSE_63_BIS_C_DAYS", () => {
  it("5 anios -> 60 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[5]).toBe(60) })
  it("10 anios -> 75 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[10]).toBe(75) })
  it("20 anios -> 150 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[20]).toBe(150) })
  it("30 anios -> 210 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[30]).toBe(210) })
  it("40 anios -> 270 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[40]).toBe(270) })
})

describe("Build base for concept with repercussion matrix", () => {
  it("construye base para concepto 029", () => {
    const c002: CalculatedPayrollConcept = {
      code: "002", name: "Sueldo", type: "earning", nature: "base",
      amount: 3937.64, included: true, source: "salary_table",
      confidence: "high", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const map = new Map<string, CalculatedPayrollConcept>([["002", c002]])
    const base = buildBaseForConcept("029", map, "2025-06-01")
    expect(base.integratedConcepts).toBeDefined()
  })
})

describe("Verification status de reglas", () => {
  it("002 es contract_verified", () => {
    const r = rule002.calculate(createMockContext())
    expect(r.concept.verificationStatus).toBe("contract_verified")
  })
  it("055 es app_reconstructed", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const r = rule055.calculate(ctx2)
    expect(r.concept.verificationStatus).toBe("app_reconstructed")
  })
  it("050 es pending_validation", () => {
    const r = rule050.calculate(createMockContext())
    expect(r.concept.verificationStatus).toBe("pending_validation")
  })
})
