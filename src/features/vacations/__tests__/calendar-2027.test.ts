import { describe, expect, it } from "vitest"
import { VACATION_CALENDAR_2027 } from "../data/calendar-2027"
import { getVacationRoleEndDate, validateCalendarRoleList } from "../domain/calendar-roles"
import { parseCivilDate } from "../domain/role-eligibility"

function role(number: number) {
  const found = VACATION_CALENDAR_2027.roles.find((item) => item.roleNumber === number)
  if (!found) throw new Error(`No existe el rol ${number}`)
  return found
}

describe("Calendario oficial de roles vacacionales 2027", () => {
  it("es la fuente publicada, autoritativa y contiene exactamente los roles 1 a 24", () => {
    expect(VACATION_CALENDAR_2027.year).toBe(2027)
    expect(VACATION_CALENDAR_2027.status).toBe("PUBLISHED")
    expect(VACATION_CALENDAR_2027.authoritative).toBe(true)
    expect(VACATION_CALENDAR_2027.roles.map((item) => item.roleNumber)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1)
    )
    expect(new Set(VACATION_CALENDAR_2027.roles.map((item) => item.roleNumber)).size).toBe(24)
  })

  it("preserva A/B como observación literal, separada de roleGroup y de las marcas", () => {
    for (const item of VACATION_CALENDAR_2027.roles) {
      expect(item.observation).toBe(item.roleNumber % 2 === 1 ? "A" : "B")
      expect(item.roleGroup).toBeUndefined()
    }
  })

  it("los roles A contienen 7-20 y los roles B únicamente 7-10", () => {
    const daysA = Array.from({ length: 14 }, (_, index) => String(index + 7))
    const daysB = ["7", "8", "9", "10"]

    for (const item of VACATION_CALENDAR_2027.roles) {
      expect(Object.keys(item.endDateByDays ?? {})).toEqual(
        item.observation === "A" ? daysA : daysB
      )
    }
  })

  it.each([
    [1, 7, "2027-01-26"],
    [1, 20, "2027-02-15"],
    [3, 20, "2027-03-16"],
    [7, 16, "2027-05-11"],
    [17, 7, "2027-09-23"],
    [17, 20, "2027-10-12"],
    [23, 15, "2028-01-03"],
    [23, 20, "2028-01-10"],
    [24, 7, "2028-01-05"],
    [24, 10, "2028-01-10"],
  ])("Rol %i para %i días termina el %s", (roleNumber, days, expectedEndDate) => {
    expect(getVacationRoleEndDate(role(roleNumber), days)).toBe(expectedEndDate)
  })

  it("no inventa 11-20 días para un rol B", () => {
    expect(getVacationRoleEndDate(role(24), 11)).toBeUndefined()
    expect(getVacationRoleEndDate(role(24), 20)).toBeUndefined()
  })

  it("conserva fechas civiles ISO válidas, incluidos los cruces a enero de 2028", () => {
    for (const item of VACATION_CALENDAR_2027.roles) {
      expect(parseCivilDate(item.startDate)).not.toBeNull()
      for (const endDate of Object.values(item.endDateByDays ?? {})) {
        expect(parseCivilDate(endDate)).not.toBeNull()
      }
    }
    expect(role(23).endDateByDays?.[20]).toBe("2028-01-10")
    expect(role(24).endDateByDays?.[10]).toBe("2028-01-10")
  })

  it("pasa la validación estructural sin exigir un endDate fijo ambiguo", () => {
    const result = validateCalendarRoleList(VACATION_CALENDAR_2027.roles)
    expect(result.valid).toBe(true)
    expect(result.missingEndDates).toBe(0)
    expect(result.duplicateNumbers).toEqual([])
  })
})
