import { describe, expect, it } from "vitest"
import { mapParsedPayslipToWorkerProfileDraft } from "../payslip-adapter"
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"

function minimalParsed(overrides: Partial<ParsedImssTarjeton["employee"]> = {}): ParsedImssTarjeton {
  return {
    schemaVersion: "1.0",
    document: { type: "imss_payroll_receipt", pageCount: 1, periodRaw: "Q1 2026", year: 2026, month: 1, half: 1 },
    employee: {
      employeeNumber: "M123",
      fullName: "Synthetic User",
      categoryName: "TECNICO RADIOLOGO 80",
      workdayHours: 8,
      employmentType: "base",
      seniority: { raw: "10 años", years: 10, fortnights: 0, days: 0, referenceDate: "2026-01-15", reconstructedEffectiveDate: "2016-01-15" },
      ...overrides,
    },
    attendance: {},
    vacations: {},
    payroll: { earnings: [], deductions: [], totalEarnings: 0, totalDeductions: 0, netPay: 0 },
    extraction: { method: "native_text", globalConfidence: 0.95, validations: { templateDetected: true } },
  }
}

describe("mapParsedPayslipToWorkerProfileDraft", () => {
  it("mapea matrícula, categoría, jornada y antigüedad correctamente", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed())
    expect(result.draft.identity.matricula).toBe("M123")
    expect(result.draft.identity.categoria).toBe("TECNICO RADIOLOGO 80")
    expect(result.draft.situation.workdayHours).toBe(8)
    expect(result.draft.situation.effectiveSeniorityDate).toBe("2016-01-15")
  })

  it("marca confirmedFields con los campos detectados", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed())
    expect(result.draft.confirmedFields).toContain("matricula")
    expect(result.draft.confirmedFields).toContain("categoria")
    expect(result.draft.confirmedFields).toContain("effectiveSeniorityDate")
    expect(result.draft.confirmedFields).toContain("workdayHours")
    expect(result.draft.confirmedFields).toContain("employmentType")
  })

  it("base → base sin requiere confirmación", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ employmentType: "base" }))
    expect(result.draft.situation.employmentType).toBe("base")
    expect(result.requiresConfirmation).not.toContain("employmentType")
  })

  it("confianza → confianza sin requiere confirmación", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ employmentType: "confianza" }))
    expect(result.draft.situation.employmentType).toBe("confianza")
    expect(result.requiresConfirmation).not.toContain("employmentType")
  })

  it("eventual requiere confirmación manual sin equivalencia canónica", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ employmentType: "eventual" }))
    expect(result.draft.situation.employmentType).toBeUndefined()
    expect(result.requiresConfirmation).toContain("employmentType")
    expect(result.notes.some((n) => n.includes("eventual"))).toBe(true)
  })

  it("confianza_a_estatuto requiere confirmación manual sin equivalencia canónica", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ employmentType: "confianza_a_estatuto" }))
    expect(result.draft.situation.employmentType).toBeUndefined()
    expect(result.requiresConfirmation).toContain("employmentType")
    expect(result.notes.some((n) => n.includes("confianza_a_estatuto"))).toBe(true)
  })

  it("no inventa datos ausentes", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ categoryName: undefined, employeeNumber: undefined }))
    expect(result.draft.identity.categoria).toBeUndefined()
    expect(result.draft.identity.matricula).toBeUndefined()
  })

  it("usa entryDate como fallback de antigüedad cuando no hay reconstructedEffectiveDate", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({
      seniority: undefined,
      entryDate: "2018-06-01",
    }))
    expect(result.draft.situation.effectiveSeniorityDate).toBe("2018-06-01")
  })

  it("nombre detectado aparece en notas (informativo)", () => {
    const result = mapParsedPayslipToWorkerProfileDraft(minimalParsed({ fullName: "User Sintetico" }))
    expect(result.notes.some((n) => n.includes("User Sintetico"))).toBe(true)
  })
})
