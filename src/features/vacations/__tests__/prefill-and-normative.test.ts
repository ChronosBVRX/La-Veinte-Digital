import { describe, expect, it } from "vitest"
import {
  parseSeniorityFromAny,
  normalizeContractType,
  isV20Period,
  prefillVacationSimulator,
} from "../domain/prefill"
import { validateAnticipation, calculateVacationRange } from "../domain/validation"
import { getEstatutoAnnualDays } from "../domain/entitlement"
import { buildSimulationResult } from "../domain/simulation"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

describe("prefillVacationSimulator", () => {
  it("respeta la precedencia estricta de fuentes: profiles -> payroll_contexts -> imported_payslips -> vacation_profile_data", () => {
    const context: WorkerContext = {
      profile: {
        fullName: "ROSAURA ZAPATA",
        matricula: "98765432",
        categoria: "ENFERMERA GENERAL",
        antiguedad: "10 años",
        adscripcion: "HGZ 1",
      },
      employment: {
        categoryName: "ENFERMERA GENERAL 80",
        categoryCode: "20570080",
        workdayHours: 8,
        employmentType: "BASE",
        entryDate: "2014-03-01",
        effectiveSeniorityDate: "2014-03-01",
        seniorityRaw: "12 años 4 qnas 2 días",
        shift: "MATUTINO",
        adscripcion: "HGZ 1 PABELLON A",
        weeklyRestDays: [5, 6],
        radiologicalExposure: false,
        contractEndDate: null,
      },
      payroll: {
        latestPeriod: "2A-JUL-2026",
        totalEarnings: 25000,
        totalDeductions: 5000,
        netPay: 20000,
        integratedMonthlySalary: null,
        recurringConcepts: [],
        payrollFacts: [],
      },
      vacations: {
        continuityMark: 1,
        periodNumberToEnjoy: 12,
        daysInYear: 20,
        enjoyedDays: 10,
        porVencer: "2026-10-14",
        porVencerRaw: "14-OCT-2026",
      },
      vacationProfile: {
        contractType: "CONFIANZA",
        category: "ENFERMERA JEFE",
        categoryCode: "9999",
        workScheduleType: "ORDINARY",
        shift: "NOCTURNO",
        adscription: "DELEGACION",
        unit: "UMF 5",
        service: "URGENCIAS",
        entryDate: "2010-01-01",
        effectiveSeniorityYears: 5,
        effectiveSeniorityFortnights: 0,
        effectiveSeniorityDays: 0,
        radiologicalExposure: "NO",
        weeklyRestDays: [0, 6],
        contractEndDate: null,
      },
    }

    const state = prefillVacationSimulator(context)

    // Precedencia:
    // 1. Nombre viene de profile
    expect(state.profile.fullName).toBe("ROSAURA ZAPATA")
    expect(state.profile.matricula).toBe("98765432")

    // 2. Categoría y código laboral vienen de employment (payroll_contexts / tarjetón)
    expect(state.profile.category).toBe("ENFERMERA GENERAL 80")
    expect(state.profile.categoryCode).toBe("20570080")

    // 3. Antigüedad: prevalece el texto de employment.seniorityRaw ("12 años 4 qnas 2 días") sobre profile.antiguedad y vacationProfile
    expect(state.profile.effectiveSeniority.years).toBe(12)
    expect(state.profile.effectiveSeniority.fortnights).toBe(4)
    expect(state.profile.effectiveSeniority.days).toBe(2)

    // 4. Vacaciones del tarjetón
    expect(state.continuityMark).toBe(1)
    expect(state.nextPeriodNumber).toBe(12)
    expect(state.dueDate).toBe("2026-10-14")

    // 5. Régimen calculado automáticamente
    expect(state.regime).toBe("SEMESTRAL")

    // 6. Procedencia registrada
    expect(state.provenance.hasLatestPayslip).toBe(true)
    expect(state.provenance.periodLabel).toBe("2A-JUL-2026")
    expect(state.provenance.isPorVencerMissingFromPayslip).toBe(false)
  })

  it("alerta puntualmente cuando porVencer falta en el tarjetón sin bloquear los demás datos", () => {
    const context: WorkerContext = {
      profile: {
        fullName: "JUAN PEREZ",
        matricula: "11111111",
        categoria: "MEDICO NO FAMILIAR",
        antiguedad: "8 años",
        adscripcion: "HGZ 24",
      },
      employment: {
        categoryName: "MEDICO NO FAMILIAR",
        categoryCode: "10101010",
        workdayHours: 8,
        employmentType: "BASE",
        entryDate: "2018-05-15",
        effectiveSeniorityDate: "2018-05-15",
        seniorityRaw: "8 años",
        shift: "VESPERTINO",
        adscripcion: "HGZ 24",
        weeklyRestDays: [5, 6],
        radiologicalExposure: false,
        contractEndDate: null,
      },
      payroll: {
        latestPeriod: "1A-JUN-2026",
        totalEarnings: 30000,
        totalDeductions: 8000,
        netPay: 22000,
        integratedMonthlySalary: null,
        recurringConcepts: [],
        payrollFacts: [],
      },
      vacations: {
        continuityMark: 0,
        periodNumberToEnjoy: 8,
        // Falta porVencer
      },
      vacationProfile: null,
    }

    const state = prefillVacationSimulator(context)
    expect(state.dueDate).toBe("")
    expect(state.provenance.isPorVencerMissingFromPayslip).toBe(true)
    expect(state.warnings.some((w) => w.includes("Por vencer"))).toBe(true)
    expect(state.profile.fullName).toBe("JUAN PEREZ")
    expect(state.continuityMark).toBe(0)
  })

  it("reconoce periodos V20 cuando la numeración es >= 220 o contiene días de 20 años", () => {
    expect(isV20Period(220)).toBe(true)
    expect(isV20Period(221)).toBe(true)
    expect(isV20Period(12, null, 15)).toBe(true)
    expect(isV20Period(10, "PERIODO V20")).toBe(true)
    expect(isV20Period(15)).toBe(false)
  })

  it("parseSeniorityFromAny soporta múltiples formatos de antigüedad", () => {
    // Tarjetón completo
    const s1 = parseSeniorityFromAny("14 años 3 qnas 1 días")
    expect(s1.years).toBe(14)
    expect(s1.fortnights).toBe(3)
    expect(s1.days).toBe(1)

    // Solo años
    const s2 = parseSeniorityFromAny("20 años")
    expect(s2.years).toBe(20)

    // Decimal
    const s3 = parseSeniorityFromAny("10.5")
    expect(s3.years).toBe(10)
    expect(s3.fortnights).toBe(12)

    // Objeto estructurado
    const s4 = parseSeniorityFromAny({ years: 7, fortnights: 2, days: 5 })
    expect(s4.years).toBe(7)
    expect(s4.fortnights).toBe(2)

    // Fecha efectiva
    const s5 = parseSeniorityFromAny(null, "2016-01-01", "2026-01-01")
    expect(s5.years).toBe(10)
  })

  it("normaliza tipo de contratación", () => {
    expect(normalizeContractType("CONFIANZA_A_ESTATUTO")).toBe("CONFIANZA_A_ESTATUTO")
    expect(normalizeContractType("confianza estatuto")).toBe("CONFIANZA_A_ESTATUTO")
    expect(normalizeContractType("temporal")).toBe("TEMPORAL")
    expect(normalizeContractType("sustituto 02")).toBe("SUSTITUTO")
    expect(normalizeContractType("base")).toBe("BASE")
  })
})

describe("Normativa: Fecha Por Vencer y Prescripción", () => {
  it("una fecha posterior a por vencer es válida y tiene 0 días de anticipación", () => {
    // dueDate = 2026-08-01, requested = 2026-08-15 (14 días después)
    const result = validateAnticipation("SEMESTRAL", "2026-08-01", "2026-08-15", false, 10)
    expect(result.allowed).toBe(true)
    expect(result.daysInAdvance).toBe(0)
  })

  it("permite fechas posteriores dentro de los 2 años de prescripción", () => {
    // dueDate = 2024-09-01, requested = 2026-08-01 (menos de 730 días)
    const result = validateAnticipation("SEMESTRAL", "2024-09-01", "2026-08-01", false, 10)
    expect(result.allowed).toBe(true)
    expect(result.daysInAdvance).toBe(0)
  })

  it("no prescribe erróneamente un periodo tomando dueDate + 730 días de forma automática", () => {
    // dueDate = 2024-01-01, requested = 2026-09-01 (más de 2 años desde adquisición)
    // La prescripción no debe calcularse tomando automáticamente dueDate como inicio
    const result = validateAnticipation("SEMESTRAL", "2024-01-01", "2026-09-01", false, 10)
    expect(result.allowed).toBe(true)
    expect(result.reasonCode).not.toBe("PRESCRIPTION_EXCEEDED")
  })

  it("en Estatuto no se permite anticipación (máximo 0 días)", () => {
    // dueDate = 2026-10-01, requested = 2026-09-15 (anticipación de 16 días)
    const result = validateAnticipation("ESTATUTO", "2026-10-01", "2026-09-15", false, 5)
    expect(result.allowed).toBe(false)
    expect(result.reasonCode).toBe("ESTATUTO_NO_ANTICIPATION")

    // fecha posterior en Estatuto es válida
    const validPost = validateAnticipation("ESTATUTO", "2026-10-01", "2026-10-05", false, 5)
    expect(validPost.allowed).toBe(true)
    expect(validPost.daysInAdvance).toBe(0)
  })
})

describe("Normativa: Estatuto Tabla Exacta", () => {
  it("aplica los días exactos sin desplazamiento", () => {
    expect(getEstatutoAnnualDays(1)).toBe(16)
    expect(getEstatutoAnnualDays(2)).toBe(17)
    expect(getEstatutoAnnualDays(3)).toBe(18)
    expect(getEstatutoAnnualDays(4)).toBe(19)
    expect(getEstatutoAnnualDays(5)).toBe(20)
    // 6 a 10 años: 22 días
    expect(getEstatutoAnnualDays(6)).toBe(22)
    expect(getEstatutoAnnualDays(8)).toBe(22)
    expect(getEstatutoAnnualDays(10)).toBe(22)
    // 11 a 15 años: 24 días
    expect(getEstatutoAnnualDays(11)).toBe(24)
    expect(getEstatutoAnnualDays(15)).toBe(24)
    // 16 a 20 años: 26 días
    expect(getEstatutoAnnualDays(16)).toBe(26)
    expect(getEstatutoAnnualDays(20)).toBe(26)
    // 21 a 25: 28, 26 a 30: 30, 31 a 35: 32
    expect(getEstatutoAnnualDays(25)).toBe(28)
    expect(getEstatutoAnnualDays(30)).toBe(30)
    expect(getEstatutoAnnualDays(35)).toBe(32)
    expect(getEstatutoAnnualDays(40)).toBe(34)
  })
})

describe("Normativa: Contratos Temporales y Sustitutos", () => {
  it("bloquea vacaciones cuando sobrepasan la fecha de fin de contrato", () => {
    const simInput = {
      workerProfile: {
        contractType: "TEMPORAL" as const,
        effectiveSeniority: { years: 2, fortnights: 0, days: 0 },
        weeklyRestDays: [5, 6],
        contractEndDate: "2026-07-15",
      },
      regime: "SEMESTRAL" as const,
      continuityMark: 0,
      nextPeriodNumber: 2,
      dueDate: "2026-07-01",
      expiredVacationPeriods: 0,
      enjoyedVacationDays: 0,
      totalYearVacationDays: 17,
      periodToEnjoy: 2,
      calendarId: "cal-2026",
      selectedInclusionMark: 0,
      selectedStartDate: "2026-07-06", // 17 días hábiles terminarán a finales de julio, después del 2026-07-15
    }

    const sim = buildSimulationResult(simInput)
    expect(sim.requiresSpecialProcess).toBe(true)
    expect(sim.warnings.some((w) => w.includes("vigencia del contrato"))).toBe(true)
    expect(sim.dateBreakdown?.exceedsContractEnd).toBe(true)
  })

  it("permite vacaciones cuando están completamente dentro de la vigencia", () => {
    const range = calculateVacationRange({
      startDate: "2026-07-01",
      entitlementUnits: 5,
      unitType: "WORKDAY",
      weeklyRestDays: [5, 6],
      mandatoryRestDates: [],
      workSchedule: { type: "ORDINARY" },
      contractEndDate: "2026-07-31",
    })
    expect(range.exceedsContractEnd).toBe(false)
  })
})
