import { describe, it, expect, vi } from "vitest"
import type { PayrollRule, EmployeePayrollProfile, ResolvedSalaryCategory, PayPeriod, SeniorityResult } from "../lib/types"
import { calculateProjection } from "../lib/engine"

vi.mock("../lib/rules", () => ({
  getAllRules: () => mockRules(),
}))

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

function mockRules(): PayrollRule[] {
  const okRule: PayrollRule = {
    id: "002",
    version: "1.0.0",
    effectiveFrom: "2025-01-01",
    dependencies: [],
    calculate: () => ({
      concept: {
        code: "002",
        name: "Sueldo Base",
        type: "earning",
        nature: "base",
        amount: 3937.64,
        included: true,
        source: "salary_table",
        confidence: "high",
        verificationStatus: "contract_verified",
        elegibilitySource: "tabular_value",
        dependencies: [],
        calculationSteps: [{ label: "Tabulador", expression: "3937.64", value: 3937.64 }],
        legalBasis: [],
        warnings: [],
      },
      dependencies: [],
    }),
  }
  const failingRule: PayrollRule = {
    id: "999",
    version: "1.0.0",
    effectiveFrom: "2025-01-01",
    dependencies: [],
    calculate: () => {
      throw new Error("base insuficiente para calcular el concepto")
    },
  }
  return [okRule, failingRule]
}

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

describe("engine - excepción de regla", () => {
  it("registra el concepto como no resuelto", () => {
    const result = calculateProjection({
      profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority,
      incidents: [], recurringConcepts: [],
    })
    expect(result.projection.unresolvedConcepts).toContain("999")
  })

  it("exige confirmación manual del concepto fallido", () => {
    const result = calculateProjection({
      profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority,
      incidents: [], recurringConcepts: [],
    })
    expect(result.projection.requiredConfirmations).toContain("999")
  })

  it("no produce el concepto en ninguna lista de montos", () => {
    const result = calculateProjection({
      profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority,
      incidents: [], recurringConcepts: [],
    })
    const all = [
      ...result.projection.earnings,
      ...result.projection.probableConcepts,
      ...result.projection.conditionalConcepts,
      ...result.projection.excludedConcepts,
    ]
    expect(all.some((c) => c.code === "999")).toBe(false)
  })

  it("baja la confianza global de la proyección", () => {
    const result = calculateProjection({
      profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority,
      incidents: [], recurringConcepts: [],
    })
    expect(result.projection.confidence).toBe("medium")
  })

  it("añade la advertencia con el mensaje de la regla", () => {
    const result = calculateProjection({
      profile, category: mockCategory, period: mockPeriod, seniority: mockSeniority,
      incidents: [], recurringConcepts: [],
    })
    expect(result.projection.warnings.some((w) => w.includes("999"))).toBe(true)
    expect(result.projection.warnings.some((w) => w.includes("base insuficiente"))).toBe(true)
  })
})
