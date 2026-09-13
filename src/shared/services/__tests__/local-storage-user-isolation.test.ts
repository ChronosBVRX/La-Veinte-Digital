// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { scopedStorageKey } from "@/shared/services/scoped-storage"
import {
  getProfile,
  saveProfile,
  getPayslips,
  savePayslip,
  getProjections,
  saveProjection,
  hasConsent,
  saveConsent,
} from "@/shared/services/local-storage"
import type { EmployeePayrollProfile, ImportedPayslip, PayrollProjection } from "@/features/nomina/lib/types"

const USER_A = "user-a-uuid"
const USER_B = "user-b-uuid"

function makeProfile(userId: string): EmployeePayrollProfile {
  return {
    id: `profile_${userId}`,
    userId,
    consentGiven: true,
    employmentType: "base",
    occupationalConditions: [],
    siapConceptMarks: [],
    categoryName: "ENFERMERA",
    workdayHours: 8,
    facts: [],
    recurringConcepts: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  }
}

function makePayslip(userId: string, period = "1A-SEP-2026"): ImportedPayslip {
  return {
    id: `slip_${userId}_${period}`,
    userId,
    period,
    periodRaw: period,
    earnings: [{ code: "002", description: "SUELDO", amount: 1000, confirmedByUser: true, includeInNextProjection: true }],
    deductions: [],
    perceptions: [],
    totalEarnings: 1000,
    totalDeductions: 0,
    netPay: 1000,
    netAmount: 1000,
    source: "pdf",
    confirmedByUser: true,
    analysisStatus: "ready",
  }
}

function makeProjection(userId: string, id: string): PayrollProjection {
  return { id, userId } as unknown as PayrollProjection
}

beforeEach(() => {
  localStorage.clear()
})

describe("localStorage aislado por usuario autenticado", () => {
  it("A guarda su perfil y B no puede leerlo", () => {
    saveProfile(USER_A, makeProfile(USER_A))

    expect(getProfile(USER_A)?.categoryName).toBe("ENFERMERA")
    expect(getProfile(USER_B)).toBeNull()
  })

  it("B guarda su perfil sin sobrescribir el de A", () => {
    saveProfile(USER_A, makeProfile(USER_A))
    const bProfile = makeProfile(USER_B)
    bProfile.categoryName = "TÉCNICO RADIÓLOGO"
    saveProfile(USER_B, bProfile)

    expect(getProfile(USER_A)?.categoryName).toBe("ENFERMERA")
    expect(getProfile(USER_B)?.categoryName).toBe("TÉCNICO RADIÓLOGO")
  })

  it("al volver a A sus datos siguen intactos", () => {
    saveProfile(USER_A, makeProfile(USER_A))
    saveProfile(USER_B, makeProfile(USER_B))

    expect(getProfile(USER_A)?.id).toBe(`profile_${USER_A}`)
  })

  it("tarjetones del mismo periodo quedan separados", () => {
    savePayslip(USER_A, makePayslip(USER_A))
    savePayslip(USER_B, makePayslip(USER_B))

    const a = getPayslips(USER_A)
    const b = getPayslips(USER_B)
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0].id).toContain(USER_A)
    expect(b[0].id).toContain(USER_B)
  })

  it("proyecciones y consentimiento están separados", () => {
    saveProjection(USER_A, makeProjection(USER_A, "p-a"))
    saveProjection(USER_B, makeProjection(USER_B, "p-b"))
    saveConsent(USER_A, true)

    expect(getProjections(USER_A).map((p) => p.id)).toEqual(["p-a"])
    expect(getProjections(USER_B).map((p) => p.id)).toEqual(["p-b"])
    expect(hasConsent(USER_A)).toBe(true)
    expect(hasConsent(USER_B)).toBe(false)
  })

  it("las claves antiguas sin dueño NO se leen como si pertenecieran al usuario actual", () => {
    localStorage.setItem("nomina_profile", JSON.stringify(makeProfile("legacy")))
    localStorage.setItem("nomina_payslips", JSON.stringify([makePayslip("legacy")]))
    localStorage.setItem("nomina_consent", "true")

    expect(getProfile(USER_A)).toBeNull()
    expect(getPayslips(USER_A)).toEqual([])
    expect(hasConsent(USER_A)).toBe(false)

    // Cuarentena lógica: no se borran.
    expect(localStorage.getItem("nomina_profile")).not.toBeNull()
    expect(localStorage.getItem("nomina_payslips")).not.toBeNull()
    expect(localStorage.getItem("nomina_consent")).toBe("true")
  })

  it("escribe siempre bajo el namespace versionado del usuario", () => {
    saveProfile(USER_A, makeProfile(USER_A))
    expect(localStorage.getItem(scopedStorageKey("nomina_profile", USER_A))).not.toBeNull()
    expect(localStorage.getItem(scopedStorageKey("nomina_profile", USER_B))).toBeNull()
  })
})
