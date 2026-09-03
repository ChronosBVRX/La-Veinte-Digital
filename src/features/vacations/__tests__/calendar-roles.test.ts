import { describe, it, expect } from "vitest"
import {
  validateCalendarRole,
  validateCalendarRoleList,
  hasDateOverlap,
  checkRoleDateEligibility,
} from "../domain/calendar-roles"
import type { VacationRole } from "../domain/types"

describe("Validación de Roles del Calendario y Empalmes", () => {
  it("Valida rol individual con fechas completas y grupo A/B", () => {
    const validRole: VacationRole = {
      id: "r-1",
      roleNumber: 1,
      startDate: "2027-01-16",
      endDate: "2027-01-31",
      roleGroup: "A",
      enabled: true,
    }
    const val = validateCalendarRole(validRole)
    expect(val.valid).toBe(true)
    expect(val.errors).toHaveLength(0)
  })

  it("Detecta fecha de término faltante o anterior a la de inicio", () => {
    const invalidEndDate: VacationRole = {
      id: "r-2",
      roleNumber: 2,
      startDate: "2027-02-01",
      endDate: "2027-01-15", // Anterior a inicio
      enabled: true,
    }
    const val = validateCalendarRole(invalidEndDate)
    expect(val.valid).toBe(false)
    expect(val.errors[0]).toContain("no puede ser anterior")
  })

  it("Detecta roles duplicados y roles sin fecha de término en la lista", () => {
    const roles: VacationRole[] = [
      { id: "1", roleNumber: 1, startDate: "2027-01-16", endDate: "2027-01-31", enabled: true },
      { id: "2", roleNumber: 1, startDate: "2027-02-01", endDate: "2027-02-15", enabled: true }, // Duplicado #1
      { id: "3", roleNumber: 3, startDate: "2027-02-16", enabled: true }, // Falta endDate
    ]
    const val = validateCalendarRoleList(roles)
    expect(val.valid).toBe(false)
    expect(val.missingEndDates).toBe(1)
    expect(val.duplicateNumbers).toContain(1)
  })

  it("Detecta correctamente empalmes entre rangos de fechas", () => {
    const p1 = { startDate: "2027-01-16", endDate: "2027-01-31" }
    const p2Overlap = { startDate: "2027-01-25", endDate: "2027-02-10" }
    const p3NoOverlap = { startDate: "2027-02-01", endDate: "2027-02-15" }

    expect(hasDateOverlap(p1, p2Overlap)).toBe(true)
    expect(hasDateOverlap(p1, p3NoOverlap)).toBe(false)
  })

  it("Verifica límite de anticipación respecto al vencimiento", () => {
    const dueDate = "2027-06-01"

    // 60 días antes (permitido)
    const resOk = checkRoleDateEligibility("2027-04-01", dueDate, 120)
    expect(resOk.allowed).toBe(true)

    // 150 días antes (excede límite de 120 días)
    const resBlocked = checkRoleDateEligibility("2026-12-01", dueDate, 120)
    expect(resBlocked.allowed).toBe(false)
    expect(resBlocked.reason).toContain("excede el límite")
  })
})
