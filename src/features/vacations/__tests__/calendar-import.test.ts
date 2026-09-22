import { describe, it, expect } from "vitest"
import { parseCalendarImport } from "../domain/calendar-import"

describe("Importación y Validación de Calendarios Vacacionales", () => {
  it("Parsea e importa correctamente desde JSON con roles completos", () => {
    const json = JSON.stringify({
      year: 2028,
      roles: [
        { roleNumber: 1, startDate: "2028-01-16", endDate: "2028-01-31", roleGroup: "A" },
        { roleNumber: 2, startDate: "2028-02-01", endDate: "2028-02-15", roleGroup: "B" },
      ],
    })

    const res = parseCalendarImport(json, 2028)
    expect(res.errors).toHaveLength(0)
    expect(res.calendar).not.toBeNull()
    expect(res.calendar?.year).toBe(2028)
    expect(res.calendar?.roles).toHaveLength(2)
    expect(res.calendar?.roles[0].endDate).toBe("2028-01-31")
  })

  it("Parsea e importa correctamente desde CSV", () => {
    const csv = `rol,inicio,termino,grupo
1,2028-01-16,2028-01-31,A
2,2028-02-01,2028-02-15,B`

    const res = parseCalendarImport(csv, 2028)
    expect(res.errors).toHaveLength(0)
    expect(res.calendar?.roles).toHaveLength(2)
    expect(res.calendar?.roles[1].roleGroup).toBe("B")
  })

  it("Bloquea cualquier importación alternativa para el calendario autoritativo 2027", () => {
    const attemptedCalendar = JSON.stringify({
      year: 2027,
      roles: [
        { roleNumber: 1, startDate: "2027-01-18", endDate: "2027-01-29" },
      ],
    })

    const res = parseCalendarImport(attemptedCalendar, 2027)
    expect(res.calendar).toBeNull()
    expect(res.errors[0]).toContain("fuente oficial autoritativa")
  })

  it("Rechaza archivo si contiene roles sin fecha de término", () => {
    const jsonMissingEnd = JSON.stringify([
      { roleNumber: 1, startDate: "2028-01-16" }, // Sin endDate
    ])

    const res = parseCalendarImport(jsonMissingEnd, 2028)
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors.some((e) => e.includes("sin fecha de término"))).toBe(true)
  })
})
