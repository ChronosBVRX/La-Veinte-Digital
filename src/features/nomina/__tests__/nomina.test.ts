import { describe, it, expect } from "vitest"
import { roundCurrency, formatCurrency, parseCurrencyInput } from "../lib/money"
import { calculateSeniority, reconstructEffectiveDate } from "../lib/seniority"
import { getPayPeriod, getCurrentPayPeriod, getNextPayPeriod } from "../lib/periods"
import {
  rule002, rule011, rule020, rule054, rule055, rule050,
} from "../lib/rules"
import { topologicalSort, calculateProjection } from "../lib/engine"
import { resolveSalaryCategory } from "../lib/categories"
import { CLAUSE_63_BIS_C_DAYS } from "../lib/types"
import type {
  PayrollRuleContext, EmployeePayrollProfile, ResolvedSalaryCategory,
  PayPeriod, SeniorityResult, PayrollRule, CalculatedPayrollConcept,
} from "../lib/types"

const mockCategory: ResolvedSalaryCategory = {
  categoryId: "1",
  categoryName: "ABOGADO 80",
  categoryCode: "ABG80",
  workdayHours: 8,
  monthlyBaseSalary: 7875.28,
  biweeklyBaseSalary: 3937.64,
  effectiveFrom: "2025-01-01",
  sourceRecordId: "built-in:abogado80",
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
  it("getCurrentPayPeriod despues del 15", () => {
    const p = getCurrentPayPeriod("2025-01-20")
    expect(p.half).toBe(2)
  })
  it("getNextPayPeriod de Q1 a Q2", () => {
    const p = getNextPayPeriod("2025-01-10")
    expect(p.half).toBe(2)
  })
  it("getNextPayPeriod diciembre a enero", () => {
    const p = getNextPayPeriod("2025-12-20")
    expect(p.year).toBe(2026)
    expect(p.month).toBe(1)
    expect(p.half).toBe(1)
  })
})

describe("seniority", () => {
  it("calculateSeniority 10 years exactly", () => {
    const r = calculateSeniority("2015-01-01", "2025-01-01")
    expect(r.years).toBe(10)
    expect(r.months).toBe(0)
    expect(r.days).toBe(0)
  })
  it("calculateSeniority with months and days", () => {
    const r = calculateSeniority("2015-03-15", "2025-07-29")
    expect(r.years).toBe(10)
    expect(r.months).toBe(4)
    expect(r.days).toBe(14)
  })
  it("calculateSeniority handles leap year totalDays", () => {
    const r = calculateSeniority("2020-02-28", "2021-02-28")
    expect(r.totalDays).toBe(366)
  })
  it("reconstructEffectiveDate", () => {
    const date = reconstructEffectiveDate(
      { years: 10, months: 0, days: 0 },
      "2025-01-15"
    )
    expect(date).toBe("2015-01-15")
  })
  it("reconstructEffectiveDate with offset days", () => {
    const date = reconstructEffectiveDate(
      { years: 5, months: 3, days: 10 },
      "2025-06-15"
    )
    expect(date).toBe("2020-03-05")
  })
})

describe("Concepto 002 - Sueldo Base", () => {
  it("usa el sueldo tabular quincenal", () => {
    const ctx = createMockContext()
    const result = rule002.calculate(ctx)
    expect(result.concept.amount).toBe(3937.64)
    expect(result.concept.code).toBe("002")
    expect(result.concept.source).toBe("salary_table")
    expect(result.concept.confidence).toBe("high")
  })
})

describe("Concepto 011 - Ayuda de Renta inciso b", () => {
  it("011 = 002 x 0.8215", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const result = rule011.calculate(ctx)
    expect(result.concept.amount).toBeCloseTo(3234.77126, 5)
    expect(result.concept.dependencies).toHaveLength(1)
    expect(result.concept.dependencies[0].code).toBe("002")
  })
  it("se recalcula cuando cambia 002", () => {
    const diffCat: ResolvedSalaryCategory = { ...mockCategory, biweeklyBaseSalary: 5000 }
    const ctx = createMockContext({ category: diffCat })
    const c002 = rule002.calculate(ctx)
    const ctx2 = createMockContext({
      category: diffCat,
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const result = rule011.calculate(ctx2)
    expect(result.concept.amount).toBeCloseTo(4107.50, 2)
  })
})

describe("Concepto 020 - Ayuda de Renta inciso a", () => {
  it("250 por quincena completa", () => {
    const result = rule020.calculate(createMockContext())
    expect(result.concept.amount).toBe(250)
    expect(result.concept.code).toBe("020")
  })
})

describe("Concepto 054 - Emanaciones Radiactivas", () => {
  it("20% sobre (002 + 011) cuando aplica", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({
      profile: {
        ...createMockContext().profile,
        occupationalConditions: [
          { type: "radiation_non_medical", enabled: true, permanentExposure: true },
        ],
      },
      calculatedConcepts: new Map([
        ["002", c002.concept],
        ["011", c011.concept],
      ]),
    })
    const result = rule054.calculate(ctx2)
    expect(result.concept.included).toBe(true)
    expect(result.concept.amount).toBeCloseTo(1434.482, 3)
    expect(result.concept.dependencies).toHaveLength(2)
  })
  it("no se activa sin condicion", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({
      calculatedConcepts: new Map([
        ["002", c002.concept],
        ["011", c011.concept],
      ]),
    })
    const result = rule054.calculate(ctx2)
    expect(result.concept.included).toBe(false)
    expect(result.concept.amount).toBe(0)
  })
  it("no se activa sin exposicion permanente", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({
      profile: {
        ...createMockContext().profile,
        occupationalConditions: [
          { type: "radiation_non_medical", enabled: true, permanentExposure: false },
        ],
      },
      calculatedConcepts: new Map([
        ["002", c002.concept],
        ["011", c011.concept],
      ]),
    })
    const result = rule054.calculate(ctx2)
    expect(result.concept.included).toBe(false)
  })
})

describe("Clausula 63 Bis, inciso c - tabla de antiguedad", () => {
  it("5 anios -> 60 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[5]).toBe(60) })
  it("10 anios -> 75 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[10]).toBe(75) })
  it("15 anios -> 105 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[15]).toBe(105) })
  it("20 anios -> 150 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[20]).toBe(150) })
  it("30 anios -> 210 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[30]).toBe(210) })
  it("40 anios -> 270 dias", () => { expect(CLAUSE_63_BIS_C_DAYS[40]).toBe(270) })
})

describe("engine - topologicalSort", () => {
  it("ordena reglas correctamente", () => {
    const rules = [rule054, rule011, rule002]
    const sorted = topologicalSort(rules)
    expect(sorted[0].id).toBe("002")
    expect(sorted[1].id).toBe("011")
    expect(sorted[2].id).toBe("054")
  })
  it("detecta dependencia circular", () => {
    const mockCalculated: CalculatedPayrollConcept = {
      code: "", name: "", type: "earning", nature: "base",
      amount: 0, included: false, source: "contract_rule",
      confidence: "high", verificationStatus: "contract_verified",
      dependencies: [], calculationSteps: [], legalBasis: [], warnings: [],
    }
    const circularA: PayrollRule = {
      id: "A", version: "1", effectiveFrom: "2025-01-01",
      dependencies: ["B"],
      calculate: () => ({ concept: mockCalculated, dependencies: ["B"] }),
    }
    const circularB: PayrollRule = {
      id: "B", version: "1", effectiveFrom: "2025-01-01",
      dependencies: ["A"],
      calculate: () => ({ concept: mockCalculated, dependencies: ["A"] }),
    }
    expect(() => topologicalSort([circularA, circularB])).toThrow("Dependencia circular")
  })
})

describe("engine - calculateProjection", () => {
  it("genera proyeccion completa", () => {
    const profile: EmployeePayrollProfile = {
      id: "test-1", userId: "user-1", consentGiven: true,
      employmentType: "base", workdayHours: 8, shift: "matutino",
      occupationalConditions: [
        { type: "radiation_non_medical", enabled: true, permanentExposure: true },
      ],
      createdAt: "2025-01-01", updatedAt: "2025-01-01",
    }
    const proj = calculateProjection(profile, mockCategory, mockPeriod, mockSeniority, [], [])
    expect(proj.earnings.length).toBeGreaterThan(0)
    expect(proj.deductions).toBeDefined()
    expect(proj.estimatedNet).toBeGreaterThan(0)
    expect(proj.snapshot).toBeDefined()
    expect(proj.snapshot?.categorySnapshot.biweeklyBaseSalary).toBe(3937.64)
    expect(proj.warnings).toBeDefined()
    expect(proj.requiredConfirmations).toBeDefined()
  })
})

describe("rules - reglas verificadas", () => {
  it("002 source es salary_table", () => {
    const r = rule002.calculate(createMockContext())
    expect(r.concept.verificationStatus).toBe("contract_verified")
  })
  it("011 source es contract_rule", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const r = rule011.calculate(ctx)
    expect(r.concept.verificationStatus).toBe("contract_verified")
  })
  it("055 verificationStatus es app_reconstructed", () => {
    const c002 = rule002.calculate(createMockContext())
    const ctx = createMockContext({
      calculatedConcepts: new Map([["002", c002.concept]]),
    })
    const c011 = rule011.calculate(ctx)
    const ctx2 = createMockContext({
      calculatedConcepts: new Map([
        ["002", c002.concept],
        ["011", c011.concept],
      ]),
    })
    const r = rule055.calculate(ctx2)
    expect(r.concept.verificationStatus).toBe("app_reconstructed")
    expect(r.concept.confidence).toBe("medium")
  })
  it("050 tiene pending_validation", () => {
    const r = rule050.calculate(createMockContext())
    expect(r.concept.verificationStatus).toBe("pending_validation")
  })
})

describe("salary category resolution", () => {
  it("resuelve por categoryId", async () => {
    const r = await resolveSalaryCategory("1", "2025-01-01")
    expect(r).not.toBeNull()
    expect(r?.biweeklyBaseSalary).toBe(3937.64)
  })
  it("resuelve por nombre", async () => {
    const r = await resolveSalaryCategory("ABOGADO 80", "2025-01-01")
    expect(r).not.toBeNull()
    expect(r?.biweeklyBaseSalary).toBe(3937.64)
  })
  it("retorna null para categoria inexistente", async () => {
    const r = await resolveSalaryCategory("NOEXISTE", "2025-01-01")
    expect(r).toBeNull()
  })
})
