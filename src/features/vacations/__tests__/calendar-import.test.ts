import { describe, it, expect } from "vitest"
import { parseCalendarImport } from "../domain/calendar-import"

describe("Importación y Validación de Calendarios Vacacionales", () => {
  it("Parsea e importa correctamente desde JSON con roles completos", () => {
    const json = JSON.stringify({
      year: 2027,
      roles: [
        { roleNumber: 1, startDate: "2027-01-16", endDate: "2027-01-31", roleGroup: "A" },
        { roleNumber: 2, startDate: "2027-02-01", endDate: "2027-02-15", roleGroup: "B" },
      ],
    })

    const res = parseCalendarImport(json, 2027)
    expect(res.errors).toHaveLength(0)
    expect(res.calendar).not.toBeNull()
    expect(res.calendar?.year).toBe(2027)
    expect(res.calendar?.roles).toHaveLength(2)
    expect(res.calendar?.roles[0].endDate).toBe("2027-01-31")
  })

  it("Parsea e importa correctamente desde CSV", () => {
    const csv = `rol,inicio,termino,grupo
1,2027-01-16,2027-01-31,A
2,2027-02-01,2027-02-15,B`

    const res = parseCalendarImport(csv, 2027)
    expect(res.errors).toHaveLength(0)
    expect(res.calendar?.roles).toHaveLength(2)
    expect(res.calendar?.roles[1].roleGroup).toBe("B")
  })

  it("Bloquea e impide importar la tabla 2026 como calendario oficial 2027", () => {
    const json2026 = JSON.stringify({
      year: 2026,
      roles: [
        { roleNumber: 1, startDate: "2026-01-16", endDate: "2026-01-31" },
      ],
    })

    const res = parseCalendarImport(json2026, 2027)
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors[0]).toContain("No se permite importar el rol de vacaciones 2026")
  })

  it("Rechaza archivo si contiene roles sin fecha de término", () => {
    const jsonMissingEnd = JSON.stringify([
      { roleNumber: 1, startDate: "2027-01-16" }, // Sin endDate
    ])

    const res = parseCalendarImport(jsonMissingEnd, 2027)
    expect(res.errors.length).toBeGreaterThan(0)
    expect(res.errors.some((e) => e.includes("sin fecha de término"))).toBe(true)
  })
})
