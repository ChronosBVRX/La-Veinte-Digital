import { describe, it, expect } from "vitest"
import {
  sanitizeWorkerContext,
  formatWorkerProfilePrompt,
  formatWorkerTarjetonEvidence,
} from "../lib/worker-context-adapter"
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

  it("procesa tarjetón completo, marcas de asistencia y continuidad vacacional", () => {
    const fullContext: WorkerContext = {
      userId: "u-999",
      profile: {
        fullName: "Roberto Carlos González",
        matricula: "98765432",
        categoria: "ENFERMERO GENERAL",
        antiguedad: "8",
        adscripcion: "HGR 220",
      },
      employment: {
        categoryName: "ENFERMERO GENERAL",
        categoryCode: "20570080",
        workdayHours: 8,
        employmentType: "Base",
        entryDate: "2018-05-16",
        effectiveSeniorityDate: "2018-05-16",
        seniorityRaw: "8 años",
        shift: "Nocturno A",
        adscripcion: "HGR 220",
        weeklyRestDays: [0, 6],
        radiologicalExposure: false,
        contractEndDate: null,
      },
      payroll: {
        latestPeriod: "2A-AGO-2026",
        totalEarnings: 14256.87,
        totalDeductions: 2450.00,
        netPay: 11806.87,
        integratedMonthlySalary: 28500.00,
        recurringConcepts: [{ conceptCode: "002" }, { conceptCode: "011" }, { conceptCode: "022" }],
        payrollFacts: [],
        lines: [
          { concept_code: "002", description: "Sueldo Base", amount: 4000.00, kind: "earning", confirmed_by_user: true },
          { concept_code: "011", description: "Ayuda Renta", amount: 3200.00, kind: "earning", confirmed_by_user: true },
          { concept_code: "022", description: "Ayuda Renta Cl. 63 Bis Inc c", amount: 1900.00, kind: "earning", confirmed_by_user: true },
          { concept_code: "151", description: "I.S.R.", amount: 1200.00, kind: "deduction", confirmed_by_user: true },
          { concept_code: "052", description: "Cuota Sindical", amount: 180.00, kind: "deduction", confirmed_by_user: true },
        ],
      },
      attendance: {
        delays: 0,
        absences: 0,
        noDelayDays: 10,
        attendanceScore: 5,
        concept033Days: 2,
        exitPasses: 1,
      },
      vacations: {
        continuityMark: 2,
        periodNumberToEnjoy: 1,
        enjoyedDays: 0,
        daysInYear: 20,
        porVencer: "2026-11-30",
      },
    } as unknown as WorkerContext

    const sanitized = sanitizeWorkerContext(fullContext)
    expect(sanitized.hasProfile).toBe(true)
    expect(sanitized.hasTarjeton).toBe(true)
    expect(sanitized.tarjeton?.periodo).toBe("2A-AGO-2026")
    expect(sanitized.tarjeton?.percepcionesTotal).toBe(14256.87)
    expect(sanitized.tarjeton?.netoPagar).toBe(11806.87)
    expect(sanitized.tarjeton?.percepciones).toHaveLength(3)
    expect(sanitized.tarjeton?.deducciones).toHaveLength(2)

    // Cálculos contractuales proporcionales (08 / sustitutos / año incompleto)
    expect(sanitized.tarjeton?.calculosProporcionales?.baseQuincenalTabular).toBe(7200)
    expect(sanitized.tarjeton?.calculosProporcionales?.cuotaDiaria).toBe(480)
    expect(sanitized.tarjeton?.calculosProporcionales?.aguinaldoAnualCompleto).toBe(43200)
    expect(sanitized.tarjeton?.calculosProporcionales?.aguinaldoPorMes).toBe(3600)
    expect(sanitized.tarjeton?.calculosProporcionales?.segundaJulioCompleta).toBe(22080)
    expect(sanitized.tarjeton?.calculosProporcionales?.segundaJulioPorMes).toBe(1840)

    // Marcas de asistencia
    expect(sanitized.asistencia?.sinRetardo).toBe(10)
    expect(sanitized.asistencia?.diasConcepto033).toBe(2)
    expect(sanitized.asistencia?.retardos).toBe(0)
    expect(sanitized.asistencia?.faltas).toBe(0)

    // Marcas de vacaciones
    expect(sanitized.vacacionesDetalle?.marcaContinuidad).toBe(2)
    expect(sanitized.vacacionesDetalle?.periodoPorDisfrutar).toBe(1)
    expect(sanitized.vacacionesDetalle?.regimenVacacional).toBe("SEMESTRAL")

    // Formateo del prompt y de la evidencia
    const prompt = formatWorkerProfilePrompt(sanitized)
    expect(prompt).toContain("Roberto Carlos González")
    expect(prompt).toContain("2A-AGO-2026")
    expect(prompt).toContain("14256.87")
    expect(prompt).toContain("11806.87")
    expect(prompt).toContain("[022] Ayuda Renta Cl. 63 Bis Inc c")
    expect(prompt).toContain("[052] Cuota Sindical")
    expect(prompt).toContain("Marcas 'Sin retardo'")
    expect(prompt).toContain("Marca 2")

    const evidence = formatWorkerTarjetonEvidence(sanitized)
    expect(evidence).toContain("Roberto Carlos González")
    expect(evidence).toContain("2A-AGO-2026")
    expect(evidence).toContain("11806.87")
    expect(evidence).toContain("sin retardo")
    expect(evidence).toContain("Marca continuidad vacacional: 2")
  })
})
