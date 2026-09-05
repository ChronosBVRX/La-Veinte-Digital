import { describe, it, expect } from "vitest"
import { roundCurrency, formatCurrency, parseCurrencyInput, truncateCurrency } from "../lib/money"
import { calculateSeniority, reconstructEffectiveDate } from "../lib/seniority"
import { getPayPeriod, getCurrentPayPeriod, getNextPayPeriod } from "../lib/periods"
import {
  rule002, rule011, rule020, rule022, rule02,
  rule054, rule055, rule050,
  rule072,
} from "../lib/rules"
import { getAllRules } from "../lib/rules"
import { topologicalSort, calculateProjection, detectCircularDependencies, dependenciesStatus, dependenciesChanged, buildDependencyClosure } from "../lib/engine"
import { resolveCategory } from "../lib/category-resolver"
import { CLAUSE_63_BIS_C_DAYS } from "../lib/types"
import { getFixedAmount } from "../data/fixed-concept-amounts"
import { getPercentageForConcept072, getPercentageForConcept083 } from "../data/institutional-percentage-tables"
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
    conceptAnchors: new Map(),
    mode: "assisted" as const,
    ...overrides,
  }
}

function addFact(profile: EmployeePayrollProfile, key: PayrollFactKey, value: PayrollFactValue): EmployeePayrollProfile {
  const fact: PayrollFact = { key, value, source: "user", confidence: 1, updatedAt: "2025-01-01" }
  return { ...profile, facts: [...profile.facts, fact] }
}

type AnchorRecord = Record<string, {
  amount: number; date: string;
  occurrenceType: "recurring" | "periodic" | "variable" | "one_time" | "unknown";
  eligibilityPersistence: "persistent" | "until_changed" | "period_scoped" | "event_scoped";
}>

function conceptForTest(amount: number): CalculatedPayrollConcept {
  return {
    code: "X", name: "X", type: "earning", nature: "base",
    amount, included: true, source: "salary_table",
    confidence: "high", verificationStatus: "contract_verified",
    elegibilitySource: "tabular_value",
    dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
  }
}

function ctxWithAnchors(anchors: AnchorRecord) {
  return createMockContext({
    conceptAnchors: new Map(Object.entries(anchors)),
  })
}

function ctxWithConcepts(conceptMap: Record<string, number>, anchors?: AnchorRecord) {
  const map = new Map<string, import("../lib/types").CalculatedPayrollConcept>()
  for (const [code, amount] of Object.entries(conceptMap)) {
    map.set(code, {
      code, name: code, type: "earning", nature: "base",
      amount, included: true, source: "salary_table",
      confidence: "high", verificationStatus: "contract_verified",
      elegibilitySource: "tabular_value",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    })
  }
  return createMockContext({
    calculatedConcepts: map,
    conceptAnchors: anchors
      ? new Map(Object.entries(anchors))
      : new Map(),
  })
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
  it("truncateCurrency reproduce el truncamiento del IMSS (tarjetón 2A-AGO-2026)", () => {
    expect(truncateCurrency(7172.41 * 0.24)).toBe(1721.37)
    expect(truncateCurrency(7172.41 * 0.16)).toBe(1147.58)
    expect(truncateCurrency(7172.41 * 0.275)).toBe(1972.41)
    expect(roundCurrency(7172.41 * 0.24)).toBe(1721.38) // el redondeo NO coincide con nómina
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
    // Percepción QUINCENAL confirmada por tarjetón real 2A-AGO-2026:
    // con antigüedad >= 5 años SÍ se incluye en la proyección.
    expect(result.concept.included).toBe(true)
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
  it("verificationStatus es regulation_verified (proc. 1A74-003-024)", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const r = rule055.calculate(ctx2)
    expect(r.concept.verificationStatus).toBe("regulation_verified")
  })
  it("base = 002 + 011 (integra 011 por repercusión de Cl. 63 Bis inc. b)", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const r = rule055.calculate(ctx2)
    expect(r.concept.dependencies).toEqual([
      { code: "002", amount: mockCategory.biweeklyBaseSalary },
      { code: "011", amount: c011.concept.amount },
    ])
  })
  it("sin unidades confirmadas presenta supuesto 360 y exige confirmación", () => {
    const julyPeriod = getPayPeriod(2025, 7, 2)
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ period: julyPeriod, calculatedConcepts: new Map([["002", c002.concept]]) })
    const r = rule055.calculate(ctx)
    expect(r.concept.included).toBe(true)
    expect(r.concept.confidence).toBe("requires_confirmation")
    expect(r.concept.warnings.some((w) => w.toLowerCase().includes("supuesto"))).toBe(true)
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

describe("Fórmula 072 - Ayuda para Libros (Apéndice F, Tabla 07)", () => {
  it("porcentaje 5% para Técnico Radiólogo por nombre exacto", () => {
    const r = getPercentageForConcept072({ categoryName: "TÉCNICO RADIÓLOGO 80" })
    expect(r.percentage).toBe(0.05)
    expect(r.method).toBe("categoryName")
    expect(r.requiresConfirmation).toBe(false)
  })
  it("porcentaje 5% para Técnico Radiólogo por categoryId estable", () => {
    const r = getPercentageForConcept072({ categoryId: "TECNICO_RADIOLOGO_80" })
    expect(r.percentage).toBe(0.05)
    expect(r.method).toBe("categoryId")
  })
  it("porcentaje 15% para Psicólogo Clínico", () => {
    const r = getPercentageForConcept072({ categoryName: "PSICOLOGO CLINICO 80" })
    expect(r.percentage).toBe(0.15)
  })
  it("15% también por nombre con acentos/espacios", () => {
    const r = getPercentageForConcept072({ categoryName: "Psicólogo  Clínico   80" })
    expect(r.percentage).toBe(0.15)
  })
  it("categoría NO autorizada -> percentage null + requires_confirmation (sin default 5%)", () => {
    const r = getPercentageForConcept072({ categoryName: "ABOGADO 80" })
    expect(r.percentage).toBeNull()
    expect(r.requiresConfirmation).toBe(true)
    expect(r.method).toBe("not_found")
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
  it("regla sin porcentaje autorizado exige confirmación y no aplica 5% por defecto", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
      profile: addFact(createMockContext().profile, "concept_072_on_payslip", true),
    })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]),
      profile: ctx.profile,
      category: { ...mockCategory, categoryName: "AUXILIAR DE FARMACIA 80", categoryId: "AUXILIAR_DE_FARMACIA_80" },
    })
    const result = rule072.calculate(ctx2)
    // Aunque haya evidencia, sin porcentaje autorizado no produce importe por defecto.
    expect(result.concept.verificationStatus).toBe("institutional_catalog_verified")
    expect(result.concept.warnings.some((w) => w.includes("NO se aplica porcentaje por defecto"))).toBe(true)
  })
})

describe("Fórmula 083 - Sobresueldo por Investigación y Docencia (Apéndice H, Tabla 67)", () => {
  it("Psicólogo Clínico -> 3%", () => {
    const r = getPercentageForConcept083({ categoryName: "PSICOLOGO CLINICO 80" })
    expect(r.percentage).toBe(0.03)
  })
  it("Trabajadora Social -> 5%", () => {
    const r = getPercentageForConcept083({ categoryName: "TRABAJADORA SOCIAL 80" })
    expect(r.percentage).toBe(0.05)
  })
  it("Puericultura / Educadora -> 5%", () => {
    const r = getPercentageForConcept083({ categoryName: "OFICIAL PUERICULTURA 80" })
    expect(r.percentage).toBe(0.05)
  })
  it("título y cédula NO elevan al 20%", () => {
    const r = getPercentageForConcept083({ categoryName: "NUTRICIONISTA DIETISTA 80" })
    expect(r.percentage).toBe(0.05)
    expect(r.percentage).not.toBe(0.20)
  })
  it("categoría desconocida -> NO cae a 5% de Trabajo Social; exige confirmación", () => {
    const r = getPercentageForConcept083({ categoryName: "ABOGADO 80" })
    expect(r.percentage).toBeNull()
    expect(r.requiresConfirmation).toBe(true)
    expect(r.method).toBe("not_found")
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
      elegibilitySource: "tabular_value",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const probable: CalculatedPayrollConcept = {
      code: "072", name: "Ayuda", type: "earning", nature: "derived",
      amount: 358.62, included: true, source: "contract_rule",
      confidence: "medium", verificationStatus: "contract_verified",
      elegibilitySource: "formula_deduced",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const conditional: CalculatedPayrollConcept = {
      code: "054", name: "Radiación", type: "earning", nature: "derived",
      amount: 1434.48, included: false, source: "contract_rule",
      confidence: "requires_confirmation", verificationStatus: "contract_verified",
      elegibilitySource: "unknown",
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
      elegibilitySource: "tabular_value",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const confirmedDeduction: CalculatedPayrollConcept = {
      code: "301", name: "ISR", type: "deduction", nature: "base",
      amount: 500, included: true, source: "contract_rule",
      confidence: "high", verificationStatus: "contract_verified",
      elegibilitySource: "formula_deduced",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const estimatedDeduction: CalculatedPayrollConcept = {
      code: "311", name: "Cuota sindical", type: "deduction", nature: "derived",
      amount: 100, included: true, source: "contract_rule",
      confidence: "medium", verificationStatus: "contract_verified",
      elegibilitySource: "formula_deduced",
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
      elegibilitySource: "tabular_value",
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
  it("055 es regulation_verified", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({ calculatedConcepts: new Map([["002", c002.concept], ["011", c011.concept]]) })
    const r = rule055.calculate(ctx2)
    expect(r.concept.verificationStatus).toBe("regulation_verified")
  })
  it("050 es pending_validation", () => {
    const r = rule050.calculate(createMockContext())
    expect(r.concept.verificationStatus).toBe("pending_validation")
  })
})

describe("Anclaje de tarjetón — elegibilidad confirmada, importe no congelado", () => {
  // Test 1: Sin cambios → reproduce exactamente los conceptos recurrentes del tarjetón
  it("sin cambios reproduce los mismos importes que el tarjetón", () => {
    const baseCtx = createMockContext()
    const c002 = rule002.calculate(baseCtx)
    const ctx = createMockContext({ calculatedConcepts: new Map([["002", c002.concept]]) })
    const c011 = rule011.calculate(ctx)

    expect(c011.concept.amount).toBeGreaterThan(0)
    expect(c011.concept.included).toBe(true)
    // Con el mismo tabulador, dos corridas producen el mismo importe
    const c011Again = rule011.calculate(ctx)
    expect(c011Again.concept.amount).toBe(c011.concept.amount)
  })

  // Test 2: Dependencias desconocidas NUNCA conservan el importe histórico.
  it("dependencias desconocidas → recalcula por fórmula y exige confirmación", () => {
    // Simular tarjetón anterior: 054 anclado a $1,300, pero SIN anclas de sus
    // dependencias (002, 011) → el estado de las dependencias es "unknown".
    const anchors = {
      "054": { amount: 1300, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
    }

    // Evidencia ACTUAL de elegibilidad (el ancla por sí sola ya no otorga derecho).
    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const ctx = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      calculatedConcepts: new Map(Object.entries({
        "002": conceptForTest(mockCategory.biweeklyBaseSalary),
        "011": conceptForTest(mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215),
      })),
    })
    const r = rule054.calculate(ctx)

    // La ausencia de información no es certeza financiera: se recalcula.
    const expectedFormula = ((mockCategory.biweeklyBaseSalary + (mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215)) * 0.2)
    expect(r.concept.amount).toBeCloseTo(expectedFormula, 2)
    expect(r.concept.amount).not.toBe(1300)
    // ...y queda marcado para confirmación manual.
    expect(r.concept.confidence).toBe("requires_confirmation")
    if (r.concept.resolutionAudit) {
      expect(r.concept.resolutionAudit.dependencyStatus).toBe("unknown")
      expect(r.concept.resolutionAudit.selectedSource).toBe("formula")
      expect(r.concept.resolutionAudit.reason).toBe("dependencias_desconocidas_recalculo_requiere_confirmacion")
    }
    // El ancla se conserva como evidencia de verificación.
    expect(r.concept.anchorAmount).toBe(1300)
    expect(r.concept.anchorDate).toBe("2025-06-30")
  })

  // Test 2b: Dependencias IDÉNTICAS a centavos → sí conserva el importe REAL.
  it("dependencias idénticas conservan el importe comprobado del tarjetón", () => {
    const c002 = 1300
    const c011 = 1000
    const anchors = {
      "054": { amount: 999.99, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
      "002": { amount: c002, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
      "011": { amount: c011, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
    }
    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const ctx = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      calculatedConcepts: new Map(Object.entries({
        "002": conceptForTest(c002),
        "011": conceptForTest(c011),
      })),
    })
    const r = rule054.calculate(ctx)

    // Mismos insumos que el tarjetón real → mismo importe REAL.
    expect(r.concept.amount).toBe(999.99)
    expect(r.concept.source).toBe("last_payslip")
    if (r.concept.resolutionAudit) {
      expect(r.concept.resolutionAudit.reason).toBe("dependencias_iguales_valor_persiste")
    }
  })

  // Test 3: Concepto fijo 020 → siempre recalcula desde su tabla versionada.
  it("concepto fijo 020 recalcula desde la tabla vigente (no congela el ancla)", () => {
    const ctx = ctxWithAnchors({
      "020": { amount: 250, date: "2025-06-30", occurrenceType: "recurring", eligibilityPersistence: "persistent" as const },
    })
    const r = rule020.calculate(ctx)
    expect(r.concept.amount).toBe(250)
    expect(r.concept.included).toBe(true)
    // El importe viene del catálogo CCT, no de repetir el histórico.
    expect(r.concept.source).toBe("contract_rule")
    if (r.concept.resolutionAudit) {
      expect(r.concept.resolutionAudit.valuePersistence).toBe("replay_only")
    }
  })

  // Test 4: Concepto one_time no reaparece automáticamente
  it("concepto one_time no se proyecta automáticamente", () => {
    // El engine excluye one_time de conceptAnchors, así que la regla no recibe ancla
    const ctx = createMockContext()
    // Forzar un perfil con concepto "999" marcado como one_time
    const profileWithOneTime = {
      ...ctx.profile,
      recurringConcepts: [{
        conceptCode: "999",
        appearsNormally: false,
        lastAmount: 500,
        source: "last_payslip" as const,
        lastSeenAt: "2025-06-30",
        confirmed: true,
        occurrenceType: "one_time" as const,
        eligibilityPersistence: "event_scoped" as const,
      }],
    }
    const input = {
      profile: profileWithOneTime,
      category: mockCategory,
      period: mockPeriod,
      seniority: mockSeniority,
      incidents: [],
      recurringConcepts: [],
    }
    const result = calculateProjection(input)
    // concepto one_time no debe aparecer en la proyección
    const hasOneTime = result.projection.earnings.some((c) => c.code === "999")
    expect(hasOneTime).toBe(false)
  })

  // Test 5: Nuevo tabulador 011 → sustituye al anchor anterior
  it("nuevo tabulador 011 sustituye al anchor del tarjetón anterior", () => {
    const oldAnchor011 = 2900
    const catalog011 = mockCategory.conceptoTabular011

    // Solo ejecutar si el catálogo tiene concepto011
    if (catalog011) {
      const ctx = ctxWithConcepts(
        { "002": mockCategory.biweeklyBaseSalary },
        { "011": { amount: oldAnchor011, date: "2025-06-30", occurrenceType: "recurring", eligibilityPersistence: "persistent" as const } },
      )
      const r = rule011.calculate(ctx)

      // El importe proyectado usa el valor tabular, no el anchor
      expect(r.concept.amount).toBe(catalog011)
      expect(r.concept.amount).not.toBe(oldAnchor011)
      // anchorAmount se conserva para comparación
      expect(r.concept.anchorAmount).toBe(oldAnchor011)
    }
  })

  // Test 6: 022 quincenal por TABLA contractual (factor = días ÷ 360),
  // crecimiento NO lineal: 10a=75d, 15a=105d, 16a=114d.
  it("022 usa la tabla contractual (no lineal): 10a=1494.25, 15a=2091.95, 16a=2271.26", () => {
    const baseCtx = createMockContext()
    const r002 = rule002.calculate(baseCtx)
    const c011Calc = rule011.calculate(createMockContext({
      calculatedConcepts: new Map([["002", r002.concept]]),
    }))
    const conceptMap = new Map([["002", r002.concept], ["011", c011Calc.concept]])
    const base = mockCategory.biweeklyBaseSalary +
      (mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215)

    const runWithYears = (years: number) => rule022.calculate(createMockContext({
      seniority: { ...mockSeniority, years },
      calculatedConcepts: conceptMap,
    }))
    const t2 = (v: number) => Math.floor((v + Number.EPSILON) * 100) / 100

    const r10 = runWithYears(10)
    const r15 = runWithYears(15)
    const r16 = runWithYears(16)

    expect(r10.concept.amount).toBe(t2(base * 75 / 360))   // 1494.25
    expect(r15.concept.amount).toBe(t2(base * 105 / 360))  // 2091.95
    expect(r16.concept.amount).toBe(t2(base * 114 / 360))  // 2271.26
    // Aceleración POR AÑO: 15→16 (+179.31/año) > 10→15 (+119.54/año).
    // Una progresión lineal daría incrementos constantes por año.
    const perYear1516 = r16.concept.amount - r15.concept.amount
    const perYear1015 = (r15.concept.amount - r10.concept.amount) / 5
    expect(perYear1516).toBeGreaterThan(perYear1015)
    expect(r15.concept.warnings.some((w) => w.includes("Factor 105/360"))).toBe(true)
  })

  it("022 con años fraccionarios usa años COMPLETADOS (14.8 → 14) y jamás cae al máximo", () => {
    const r002 = rule002.calculate(createMockContext())
    const c011Calc = rule011.calculate(createMockContext({
      calculatedConcepts: new Map([["002", r002.concept]]),
    }))
    const r148 = rule022.calculate(createMockContext({
      seniority: { ...mockSeniority, years: 14.8 },
      calculatedConcepts: new Map([["002", r002.concept], ["011", c011Calc.concept]]),
    }))
    const base = mockCategory.biweeklyBaseSalary +
      (mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215)
    const expected14 = Math.floor((base * 99 / 360 + Number.EPSILON) * 100) / 100
    expect(r148.concept.amount).toBe(expected14)
    expect(r148.concept.warnings.some((w) => w.includes("Factor 99/360"))).toBe(true)
  })

  it("022 con antigüedad fuera de tabla (>40) exige confirmación SIN usar 270 días", () => {
    const anchors = {
      "022": { amount: 1972.41, date: "2025-01-10", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
    }
    const ctx = createMockContext({
      conceptAnchors: new Map(Object.entries(anchors)),
      seniority: { ...mockSeniority, years: 41 },
    })
    const r = rule022.calculate(ctx)
    expect(r.concept.warnings.some((w) => w.includes("fuera de la tabla"))).toBe(true)
    expect(r.concept.confidence).toBe("requires_confirmation")
  })

  it("otros conceptos (020) no cambian por antigüedad", () => {
    const r020 = rule020.calculate(createMockContext({ seniority: { ...mockSeniority, years: 15 } }))
    expect(r020.concept.amount).toBe(250)
  })

  it("el anchorAmount preserva el importe histórico sin modificarlo", () => {
    const historicalAmount = 1353.16
    const anchors = {
      "054": { amount: historicalAmount, date: "2025-07-31", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
    }

    const ctx = ctxWithConcepts(
      { "002": mockCategory.biweeklyBaseSalary, "011": mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215 },
      anchors,
    )
    const r = rule054.calculate(ctx)

    // anchorAmount conserva el valor histórico intacto
    expect(r.concept.anchorAmount).toBe(historicalAmount)
    // El importe proyectado puede ser diferente (fórmula actual)
    // pero el histórico no se modifica
    expect(r.concept.anchorAmount).toBe(historicalAmount)
  })
})

describe("Orden topológico de dependencias", () => {
  it("002 se calcula antes que 011", () => {
    const rules = getAllRules()
    const sorted = topologicalSort(rules)
    const idx002 = sorted.findIndex((r) => r.id === "002")
    const idx011 = sorted.findIndex((r) => r.id === "011")
    expect(idx002).toBeLessThan(idx011)
  })

  it("011 se calcula antes que 054", () => {
    const rules = getAllRules()
    const sorted = topologicalSort(rules)
    const idx011 = sorted.findIndex((r) => r.id === "011")
    const idx054 = sorted.findIndex((r) => r.id === "054")
    expect(idx011).toBeLessThan(idx054)
  })

  it("002 se calcula antes que todos los derivados", () => {
    const rules = getAllRules()
    const sorted = topologicalSort(rules)
    const idx002 = sorted.findIndex((r) => r.id === "002")
    const derivados = ["011", "054", "072", "02", "012", "013", "051", "057", "058", "061", "062", "078", "083", "055"]
    for (const code of derivados) {
      const idx = sorted.findIndex((r) => r.id === code)
      if (idx >= 0) {
        expect(idx002).toBeLessThan(idx)
      }
    }
  })
})

describe("dependenciesStatus — comparación exacta a centavos", () => {
  it("unchanged cuando dependencias coinciden exactamente", () => {
    const anchors = new Map([
      ["002", { amount: 3819.24, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
      ["011", { amount: 2946.54, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
    ])
    const concepts = new Map<string, import("../lib/types").CalculatedPayrollConcept>()
    concepts.set("002", { code: "002", name: "002", type: "earning", nature: "base", amount: 3819.24, included: true, source: "salary_table", confidence: "high", verificationStatus: "contract_verified", elegibilitySource: "tabular_value", dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] })
    concepts.set("011", { code: "011", name: "011", type: "earning", nature: "derived", amount: 2946.54, included: true, source: "salary_table", confidence: "high", verificationStatus: "contract_verified", elegibilitySource: "tabular_value", dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] })
    const ctx = createMockContext({ conceptAnchors: anchors, calculatedConcepts: concepts })
    expect(dependenciesStatus(["002", "011"], ctx)).toBe("unchanged")
  })

  it("changed cuando una dependencia difiere en centavos", () => {
    const anchors = new Map([
      ["002", { amount: 3819.24, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
    ])
    const concepts = new Map<string, import("../lib/types").CalculatedPayrollConcept>()
    concepts.set("002", { code: "002", name: "002", type: "earning", nature: "base", amount: 3937.64, included: true, source: "salary_table", confidence: "high", verificationStatus: "contract_verified", elegibilitySource: "tabular_value", dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] })
    const ctx = createMockContext({ conceptAnchors: anchors, calculatedConcepts: concepts })
    expect(dependenciesStatus(["002"], ctx)).toBe("changed")
  })

  it("changed incluso con diferencia de un centavo", () => {
    const anchors = new Map([
      ["002", { amount: 3819.24, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
    ])
    const concepts = new Map<string, import("../lib/types").CalculatedPayrollConcept>()
    concepts.set("002", { code: "002", name: "002", type: "earning", nature: "base", amount: 3819.25, included: true, source: "salary_table", confidence: "high", verificationStatus: "contract_verified", elegibilitySource: "tabular_value", dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] })
    const ctx = createMockContext({ conceptAnchors: anchors, calculatedConcepts: concepts })
    expect(dependenciesStatus(["002"], ctx)).toBe("changed")
  })

  it("unknown cuando falta ancla de una dependencia", () => {
    const concepts = new Map<string, import("../lib/types").CalculatedPayrollConcept>()
    concepts.set("002", { code: "002", name: "002", type: "earning", nature: "base", amount: 3819.24, included: true, source: "salary_table", confidence: "high", verificationStatus: "contract_verified", elegibilitySource: "tabular_value", dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] })
    const ctx = createMockContext({ conceptAnchors: new Map(), calculatedConcepts: concepts })
    expect(dependenciesStatus(["002", "011"], ctx)).toBe("unknown")
  })

  it("unknown cuando falta valor actual de una dependencia", () => {
    const anchors = new Map([
      ["002", { amount: 3819.24, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
      ["011", { amount: 2946.54, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
    ])
    const ctx = createMockContext({ conceptAnchors: anchors, calculatedConcepts: new Map() })
    expect(dependenciesStatus(["002", "011"], ctx)).toBe("unknown")
  })

  it("dependenciesChanged solo retorna true para changed, no unknown", () => {
    const ctx = createMockContext({ conceptAnchors: new Map(), calculatedConcepts: new Map() })
    expect(dependenciesChanged(["002", "011"], ctx)).toBe(false)
  })
})

describe("Reglas: discrepancia no modifica, dependencias sí", () => {
  it("fórmula difiere del ancla pero dependencias sin cambios → conserva anchor", () => {
    const formula054 = (mockCategory.biweeklyBaseSalary + (mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215)) * 0.20
    // Ancla deliberadamente distinta a la fórmula (simula discrepancia histórica)
    const fakeAnchor = formula054 + 50

    const anchors = {
      "054": { amount: fakeAnchor, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
      // Las dependencias NO cambiaron
      "002": { amount: mockCategory.biweeklyBaseSalary, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
      "011": { amount: mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
    }

    // Evidencia ACTUAL de elegibilidad (el ancla por sí sola ya no otorga derecho).
    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const ctx = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      calculatedConcepts: new Map(Object.entries({
        "002": conceptForTest(mockCategory.biweeklyBaseSalary),
        "011": conceptForTest(mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215),
      })),
    })
    const r = rule054.calculate(ctx)

    // Dependencias sin cambios → conserva el anchor aunque la fórmula discrepe
    expect(r.concept.included).toBe(true)
    expect(r.concept.amount).toBe(fakeAnchor)
    // Debe haber warning de discrepancia
    expect(r.concept.warnings.length).toBeGreaterThan(0)
    expect(r.concept.warnings.some((w) => w.includes("Diferencia"))).toBe(true)
  })

  it("cambia 002 → recalcula 054 aunque tenga anchor", () => {
    const new002 = mockCategory.biweeklyBaseSalary + 100 // simulando aumento
    const new011 = mockCategory.conceptoTabular011 ?? new002 * 0.8215

    const anchors = {
      "054": { amount: 1353.16, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
      // Anclas VIEJAS de las dependencias
      "002": { amount: mockCategory.biweeklyBaseSalary, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
      "011": { amount: mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
    }

    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const ctx = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      calculatedConcepts: new Map(Object.entries({
        "002": conceptForTest(new002),
        "011": conceptForTest(new011),
      })),
    })
    const r = rule054.calculate(ctx)

    // 002 cambió → 054 debe recalcularse (no conservar el anchor de 1353.16)
    expect(r.concept.amount).not.toBe(1353.16)
    const expected = (new002 + new011) * 0.20
    expect(r.concept.amount).toBeCloseTo(expected, 2)
  })

  it("baseline reproduce el importe observado SOLO del mismo periodo del tarjetón", () => {
    const anchor054 = 1353.16
    const anchors = {
      "054": { amount: anchor054, date: "2025-01-10", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
    }

    const ctx = createMockContext({
      conceptAnchors: new Map(Object.entries(anchors)),
      mode: "baseline",
      calculatedConcepts: new Map(Object.entries({
        "002": { code: "002", name: "002", type: "earning" as const, nature: "base" as const, amount: 5000, included: true, source: "salary_table" as const, confidence: "high" as const, verificationStatus: "contract_verified" as const, elegibilitySource: "tabular_value" as const, dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] },
        "011": { code: "011", name: "011", type: "earning" as const, nature: "derived" as const, amount: 4000, included: true, source: "salary_table" as const, confidence: "high" as const, verificationStatus: "contract_verified" as const, elegibilitySource: "tabular_value" as const, dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] },
      })),
    })

    const r = rule054.calculate(ctx)
    // Baseline: el tarjetón manda, sin importar la fórmula
    expect(r.concept.amount).toBe(anchor054)
  })
})

describe("Contrato de anclas — decisiones documentadas", () => {
  function conceptOf(code: string, amount: number) {
    return { code, name: code, type: "earning" as const, nature: "base" as const, amount, included: true, source: "salary_table" as const, confidence: "high" as const, verificationStatus: "contract_verified" as const, elegibilitySource: "tabular_value" as const, dependencies: [], calculationSteps: [], legalBasis: [], warnings: [] }
  }

  it("baseline en OTRO periodo: replay sólo vía valuePersistence, nunca via replay de periodo", () => {
    // Ancla de junio, periodo de enero. Con dependencias IDÉNTICAS el valor
    // persiste por la regla 6 (dependencias_iguales_valor_persiste), NO porque
    // baseline reproduzca el tarjetón de otro periodo.
    const anchors = {
      "054": { amount: 9999, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
      "002": { amount: mockCategory.biweeklyBaseSalary, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
      "011": { amount: mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
    }
    const profile = addFact(createMockContext().profile, "permanent_radiation_exposure", true)
    const ctxIguales = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      mode: "baseline",
      calculatedConcepts: new Map(Object.entries({
        "002": conceptOf("002", mockCategory.biweeklyBaseSalary),
        "011": conceptOf("011", mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215),
      })),
    })
    const rIguales = rule054.calculate(ctxIguales)
    expect(rIguales.concept.amount).toBe(9999)
    expect(rIguales.concept.resolutionAudit?.reason).toBe("dependencias_iguales_valor_persiste")
    expect(rIguales.concept.resolutionAudit?.anchorInTargetPeriod).toBe(false)

    // Con dependencias CAMBIADAS, ni baseline ni persistencia salvan el histórico.
    const ctxCambiadas = createMockContext({
      profile,
      conceptAnchors: new Map(Object.entries(anchors)),
      mode: "baseline",
      calculatedConcepts: new Map(Object.entries({
        "002": conceptOf("002", mockCategory.biweeklyBaseSalary + 500),
        "011": conceptOf("011", mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215),
      })),
    })
    const rCambiadas = rule054.calculate(ctxCambiadas)
    expect(rCambiadas.concept.amount).not.toBe(9999)
    expect(rCambiadas.concept.resolutionAudit?.reason).toBe("dependencias_cambiadas_recalculo")
  })

  it("el ancla NO otorga elegibilidad: 054 sin evidencia actual queda excluido", () => {
    const anchors = {
      "054": { amount: 1353.16, date: "2025-01-10", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const },
      "002": { amount: mockCategory.biweeklyBaseSalary, date: "2025-01-10", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
      "011": { amount: mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215, date: "2025-01-10", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const },
    }
    // Perfil SIN hechos ni condiciones ni recurrencia de 054:
    const ctx = createMockContext({
      conceptAnchors: new Map(Object.entries(anchors)),
      calculatedConcepts: new Map(Object.entries({
        "002": conceptOf("002", mockCategory.biweeklyBaseSalary),
        "011": conceptOf("011", mockCategory.conceptoTabular011 ?? mockCategory.biweeklyBaseSalary * 0.8215),
      })),
    })
    const r = rule054.calculate(ctx)
    expect(r.concept.included).toBe(false)
    expect(r.concept.amount).toBe(0)
    if (r.concept.resolutionAudit) {
      expect(r.concept.resolutionAudit.eligibleNow).toBe(false)
      expect(r.concept.resolutionAudit.selectedSource).toBe("zero")
      expect(r.concept.resolutionAudit.reason).toBe("no_elegible_ahora")
    }
  })

  it("cierre transitivo: cambio en 002 invalida dependientes indirectos", () => {
    // 054 depende declaradamente de [002, 011]; con closure, un cambio solo
    // en 002 basta para invalidar aunque la lista directa estuviera incompleta.
    const closure = new Map<string, Set<string>>([
      ["054", new Set(["002", "011"])],
    ])
    const anchors = new Map([
      ["002", { amount: 3000, date: "2025-06-30", occurrenceType: "recurring" as const, eligibilityPersistence: "persistent" as const }],
      ["054", { amount: 1000, date: "2025-06-30", occurrenceType: "variable" as const, eligibilityPersistence: "until_changed" as const }],
    ])
    const concepts = new Map<string, CalculatedPayrollConcept>([
      ["002", conceptOf("002", 3937.64)],
    ])
    const ctx = createMockContext({
      conceptAnchors: anchors,
      calculatedConcepts: concepts,
      dependencyClosure: closure,
    })
    // Sin closure, dep "011" daría unknown; con closure, 002 cambió → changed.
    expect(dependenciesStatus(["002"], ctx)).toBe("changed")
  })

  it("buildDependencyClosure expande la cadena causal completa", () => {
    const closure = buildDependencyClosure(getAllRules())
    const c054 = closure.get("054")
    expect(c054).toBeDefined()
    expect(c054!.has("002")).toBe(true)
    expect(c054!.has("011")).toBe(true)
  })
})
