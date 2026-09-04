import { describe, it, expect } from "vitest"
import { getRequiredPeriodCount, buildVacationPlan } from "../domain/annual-plan"
import type { VacationPlanInput, WorkerProfile } from "../domain/types"

describe("Planificador Anual de Vacaciones y Encadenamiento de Continuidad", () => {
  const baseProfile: WorkerProfile = {
    contractType: "BASE",
    effectiveSeniority: { years: 5, fortnights: 0, days: 0 },
    weeklyRestDays: [0, 6],
  }

  it("Determina cantidad dinámica de periodos según régimen y V20", () => {
    expect(getRequiredPeriodCount("SEMESTRAL", false)).toBe(2)
    expect(getRequiredPeriodCount("SEMESTRAL", true)).toBe(3)
    expect(getRequiredPeriodCount("CUATRIMESTRAL", false)).toBe(3)
    expect(getRequiredPeriodCount("CUATRIMESTRAL", true)).toBe(4)
  })

  it("Encadena la continuidad correctamente: 1 -> 1 (cierra en 2)", () => {
    const input: VacationPlanInput = {
      workerProfile: baseProfile,
      regime: "SEMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-06-01", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-12-01", confirmed: true, sourcePayslipPeriod: "2026-16" },
      ],
      calendar: null,
      integratedMonthlySalary: 30000,
    }

    // Periodo 1 con marca 1
    const plan = buildVacationPlan(input, {
      1: { mark: 1 },
      2: { mark: 1 },
    })

    expect(plan.periods).toHaveLength(2)
    expect(plan.periods[0].continuityBefore).toBe(0)
    expect(plan.periods[0].continuityAfter).toBe(1)
    expect(plan.periods[1].continuityBefore).toBe(1)
    expect(plan.periods[1].continuityAfter).toBe(2)
    expect(plan.periods[0].allowed).toBe(true)
    expect(plan.periods[1].allowed).toBe(true)
  })

  it("Encadena la continuidad correctamente: 4 -> 9 (cierra en 13)", () => {
    const input: VacationPlanInput = {
      workerProfile: baseProfile,
      regime: "SEMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, confirmed: true, sourcePayslipPeriod: "2026-16" },
      ],
      calendar: null,
      integratedMonthlySalary: 30000,
    }

    const plan = buildVacationPlan(input, {
      1: { mark: 4 },
      2: { mark: 9 },
    })

    expect(plan.periods[0].continuityAfter).toBe(4)
    expect(plan.periods[1].continuityBefore).toBe(4)
    expect(plan.periods[1].continuityAfter).toBe(13)
    expect(plan.periods[0].payment?.culturalHelp048).toBe(31000)
    expect(plan.periods[1].payment?.culturalHelp048).toBe(0)
  })

  it("El periodo extraordinario V20 es independiente y no altera la cadena ordinaria", () => {
    const input: VacationPlanInput = {
      workerProfile: { ...baseProfile, effectiveSeniority: { years: 22, fortnights: 0, days: 0 } },
      regime: "SEMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "v20", kind: "V20", confirmed: true, sourcePayslipPeriod: "2026-16" },
      ],
      calendar: null,
      integratedMonthlySalary: 30000,
    }

    const plan = buildVacationPlan(input, {
      1: { mark: 1 },
      2: { mark: 1 },
      3: { mark: 6 },
    })

    expect(plan.periods).toHaveLength(3)
    expect(plan.periods[2].kind).toBe("V20")
    expect(plan.periods[2].continuityBefore).toBeUndefined()
    expect(plan.periods[2].payment?.premium029).toBe(3750)
    expect(plan.periods[2].payment?.culturalHelp048).toBe(0)
  })
})
