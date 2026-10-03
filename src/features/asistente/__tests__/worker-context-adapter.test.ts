import { describe, it, expect } from "vitest"
import { sanitizeWorkerContext, formatWorkerProfilePrompt } from "../lib/worker-context-adapter"
import type { WorkerContext } from "@/shared/server/worker-context"

describe("worker-context-adapter", () => {
  it("sanitiza correctamente un WorkerContext completo sin exponer PII", () => {
    const rawContext: WorkerContext = {
      userId: "u-123",
      profile: {
        fullName: "Juan Pérez",
        matricula: "99123456",
        categoria: "TÉCNICO RADIÓLOGO",
        antiguedad: "12",
        adscripcion: "HGZ No. 1",
      },
      employment: {
        categoryName: "TÉCNICO RADIÓLOGO",
        categoryCode: "20570080",
        workdayHours: 8,
        employmentType: "Base",
        entryDate: "2014-03-15",
        effectiveSeniorityDate: "2014-03-15",
        seniorityRaw: "12 años",
        shift: "Matutino",
        adscripcion: "HGZ No. 1",
        weeklyRestDays: [0, 6],
        radiologicalExposure: true,
        contractEndDate: null,
      },
      payroll: {
        totalEarnings: 15000,
        totalDeductions: 3000,
        netPay: 12000,
        integratedMonthlySalary: 22500,
        recurringConcepts: [{ conceptCode: "011" }, { conceptCode: "063" }],
        payrollFacts: [],
        latestPeriod: "2026-08-15",
      },
      vacations: {
        porVencer: "2026-12-31",
      },
      vacationProfile: {
        effectiveSeniorityYears: 12,
        effectiveSeniorityFortnights: 288,
        effectiveSeniorityDays: 4380,
      } as unknown as WorkerContext["vacationProfile"],
    } as unknown as WorkerContext

    const sanitized = sanitizeWorkerContext(rawContext)
    expect(sanitized.hasProfile).toBe(true)
    expect(sanitized.nombre).toBe("Juan Pérez")
    expect(sanitized.categoria).toBe("TÉCNICO RADIÓLOGO")
    expect(sanitized.categoriaCodigo).toBe("20570080")
    expect(sanitized.jornadaHoras).toBe(8)
    expect(sanitized.antiguedadAnios).toBe(12)
    expect(sanitized.tipoPlaza).toBe("Base")
    expect(sanitized.turno).toBe("Matutino")
    expect(sanitized.adscripcion).toBe("HGZ No. 1")
    expect(sanitized.exposicionRadiologica).toBe(true)
    expect(sanitized.conceptosRecurrentes).toEqual(["011", "063"])
    expect(sanitized.vacacionesPorVencer).toBe("2026-12-31")

    // PII estricta: asegurar que no existen propiedades de RFC, CURP, cuenta
    const keys = Object.keys(sanitized)
    expect(keys).not.toContain("curp")
    expect(keys).not.toContain("rfc")
    expect(keys).not.toContain("nss")
    expect(keys).not.toContain("cuenta")
  })

  it("devuelve hasProfile false cuando el contexto está vacío", () => {
    const emptyContext = {
      profile: null,
      employment: null,
      payroll: null,
    } as unknown as WorkerContext
    const sanitized = sanitizeWorkerContext(emptyContext)
    expect(sanitized.hasProfile).toBe(false)
    expect(formatWorkerProfilePrompt(sanitized)).toBe("")
  })

  it("formatea el prompt del perfil con instrucciones de personalización", () => {
    const sanitized = {
      hasProfile: true,
      nombre: "María López",
      categoria: "ENFERMERA GENERAL",
      jornadaHoras: 6.5,
      antiguedadAnios: 5,
      tipoPlaza: "Base",
      adscripcion: "UMF 47",
    }
    const prompt = formatWorkerProfilePrompt(sanitized)
    expect(prompt).toContain("María López")
    expect(prompt).toContain("ENFERMERA GENERAL")
    expect(prompt).toContain("6.5 horas diarias")
    expect(prompt).toContain("5 años")
    expect(prompt).toContain("INSTRUCCIÓN DE PERSONALIZACIÓN")
  })
})
