import { describe, expect, it } from "vitest"
import { VACATION_CALENDAR_2027 } from "../data/calendar-2027"
import { buildVacationPlan } from "../domain/annual-plan"
import type { VacationPlanInput } from "../domain/types"

function inputForYears(years: number): VacationPlanInput {
  return {
    workerProfile: {
      contractType: "BASE",
      effectiveSeniority: { years, fortnights: 0, days: 0 },
      weeklyRestDays: [0, 6],
    },
    regime: "SEMESTRAL",
    initialContinuity: 0,
    entitlements: [
      { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-01-01", confirmed: true },
      { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-07-01", confirmed: true },
    ],
    calendar: VACATION_CALENDAR_2027,
    integratedMonthlySalary: 30000,
  }
}

describe("Plan anual con la matriz oficial 2027", () => {
  it("resuelve el término por los días reales del periodo, no mediante cálculo hábil", () => {
    const role17 = VACATION_CALENDAR_2027.roles.find((item) => item.roleNumber === 17)!
    const plan = buildVacationPlan(inputForYears(1), {
      1: { mark: 0, role: role17 },
    })

    expect(plan.periods[0].units).toBe(16)
    expect(plan.periods[0].startDate).toBe("2027-09-13")
    expect(plan.periods[0].endDate).toBe("2027-10-06")
    expect(plan.periods[0].selectedRole?.endDate).toBe("2027-10-06")
  })

  it("bloquea explícitamente un rol B cuando la tabla no contempla esa cantidad de días", () => {
    const role24 = VACATION_CALENDAR_2027.roles.find((item) => item.roleNumber === 24)!
    const plan = buildVacationPlan(inputForYears(5), {
      1: { mark: 0, role: role24 },
    })

    expect(plan.periods[0].units).toBe(20)
    expect(plan.periods[0].allowed).toBe(false)
    expect(plan.periods[0].endDate).toBeUndefined()
    expect(plan.periods[0].reasons).toContain(
      "El Rol 24 no contempla oficialmente 20 días en la tabla 2027."
    )
  })
})
