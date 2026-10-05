import { describe, it, expect } from "vitest"
import { getRequiredPeriodCount, buildVacationPlan } from "../domain/annual-plan"
import { PERIOD_SEQUENCE_INVERTED_MESSAGE } from "../domain/role-eligibility"
import { VACATION_CALENDAR_2027 } from "../data/calendar-2027"
import type { VacationPlanInput, VacationRole, WorkerProfile } from "../domain/types"

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
    expect(plan.periods[0].stage).toBe("FIRST_FRACTION")
    expect(plan.periods[1].continuityBefore).toBe(1)
    expect(plan.periods[1].continuityAfter).toBe(2)
    expect(plan.periods[1].stage).toBe("SECOND_FRACTION")
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
    expect(plan.periods[0].stage).toBe("FIRST_FRACTION_4_9")
    expect(plan.periods[1].continuityBefore).toBe(4)
    expect(plan.periods[1].continuityAfter).toBe(13)
    expect(plan.periods[1].stage).toBe("SECOND_FRACTION_4_9")
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

  it("No pierde días en años impares con secuencia 1 -> 1 (ej. 17 días a los 2 años = 8 + 9)", () => {
    const input: VacationPlanInput = {
      workerProfile: { ...baseProfile, effectiveSeniority: { years: 2, fortnights: 0, days: 0 } },
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
      1: { mark: 1 },
      2: { mark: 1 },
    })

    expect(plan.periods[0].units).toBe(8)
    expect(plan.periods[1].units).toBe(9)
    expect((plan.periods[0].units ?? 0) + (plan.periods[1].units ?? 0)).toBe(17)
  })

  it("Secuencia 2 -> 3 otorga 15-20 días continuos en Marca 2 y 10-15 días en Marca 3 (sin 048)", () => {
    const input: VacationPlanInput = {
      workerProfile: { ...baseProfile, effectiveSeniority: { years: 5, fortnights: 0, days: 0 } },
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
      1: { mark: 2 },
      2: { mark: 3 },
    })

    expect(plan.periods[0].units).toBe(20)
    expect(plan.periods[1].units).toBe(15)
    expect(plan.periods[0].payment?.culturalHelp048).toBe(0)
    expect(plan.periods[1].payment?.culturalHelp048).toBe(0)
  })

  describe("Secuencia del ciclo vacacional (Procedimiento 1A74-003-025 y Anexo 1 1A74-022-065)", () => {
    const roleJan: VacationRole = {
      id: "r-jan",
      roleNumber: 1,
      startDate: "2027-01-05",
      endDate: "2027-01-15",
      enabled: true,
    }
    const roleFeb: VacationRole = {
      id: "r-feb",
      roleNumber: 2,
      startDate: "2027-02-10",
      endDate: "2027-02-20",
      enabled: true,
    }
    const roleFebCont: VacationRole = {
      id: "r-feb-cont",
      roleNumber: 3,
      startDate: "2027-02-21",
      endDate: "2027-03-03",
      enabled: true,
    }
    const roleMar: VacationRole = {
      id: "r-mar",
      roleNumber: 4,
      startDate: "2027-03-10",
      endDate: "2027-03-20",
      enabled: true,
    }

    const semestralInput: VacationPlanInput = {
      workerProfile: baseProfile,
      regime: "SEMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "p1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-04-15", confirmed: true },
        { id: "p2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-04-30", confirmed: true },
      ],
      calendar: {
        id: "cal-test",
        year: 2027,
        version: "v1",
        status: "PUBLISHED",
        sourceName: "IMSS",
        roles: [roleJan, roleFeb, roleFebCont, roleMar],
      },
      integratedMonthlySalary: 30000,
    }

    it("1) Período 1 en enero + Período 2 en febrero -> evaluado como VÁLIDO", () => {
      const plan = buildVacationPlan(semestralInput, {
        1: { mark: 1, role: roleJan },
        2: { mark: 1, role: roleFeb },
      })

      expect(plan.periods[0].allowed).toBe(true)
      expect(plan.periods[1].allowed).toBe(true)
      expect(plan.isValidPlan).toBe(true)
    })

    it("2) Período 1 en febrero + Período 2 en enero -> INVALIDAR por inversión de secuencia aunque enero cumpla los 120 días de anticipación", () => {
      const plan = buildVacationPlan(semestralInput, {
        1: { mark: 1, role: roleFeb },
        2: { mark: 1, role: roleJan },
      })

      expect(plan.periods[0].allowed).toBe(true)
      expect(plan.periods[1].allowed).toBe(false)
      expect(plan.periods[1].eligibility?.reasonCode).toBe("PERIOD_SEQUENCE_INVERTED")
      expect(plan.periods[1].reasons).toContain(PERIOD_SEQUENCE_INVERTED_MESSAGE)
      expect(plan.isValidPlan).toBe(false)
    })

    it("3) Período 1 en febrero + Período 2 en marzo -> evaluado normalmente como VÁLIDO", () => {
      const plan = buildVacationPlan(semestralInput, {
        1: { mark: 4, role: roleFeb },
        2: { mark: 9, role: roleMar },
      })

      expect(plan.periods[0].allowed).toBe(true)
      expect(plan.periods[1].allowed).toBe(true)
      expect(plan.isValidPlan).toBe(true)
    })

    it("4) Continuidad inmediata: P1 (10-20 feb) + P2 (21 feb-3 mar) y roles consecutivos 2027 con marcas 2->3 -> VÁLIDOS sin exigir separación artificial", () => {
      // Caso A: P1 10-20 febrero + P2 21 febrero-3 marzo
      const planImmediate = buildVacationPlan(semestralInput, {
        1: { mark: 2, role: roleFeb },
        2: { mark: 3, role: roleFebCont },
      })

      expect(planImmediate.periods[0].stage).toBe("FIRST_COMPLETE_PERIOD")
      expect(planImmediate.periods[1].stage).toBe("SECOND_COMPLETE_PERIOD")
      expect(planImmediate.periods[0].allowed).toBe(true)
      expect(planImmediate.periods[1].allowed).toBe(true)
      expect(planImmediate.isValidPlan).toBe(true)

      // Caso B: Roles consecutivos del calendario oficial 2027 con fraccionamiento 1->1 (10 días: Rol 5 termina 2027-04-01, Rol 6 inicia 2027-04-02)
      const role5 = VACATION_CALENDAR_2027.roles.find((r) => r.roleNumber === 5)!
      const role6 = VACATION_CALENDAR_2027.roles.find((r) => r.roleNumber === 6)!
      const role7 = VACATION_CALENDAR_2027.roles.find((r) => r.roleNumber === 7)!
      const planOfficialConsecutive11 = buildVacationPlan(
        {
          ...semestralInput,
          calendar: VACATION_CALENDAR_2027,
          entitlements: [
            { id: "p1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-06-15", confirmed: true },
            { id: "p2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-07-15", confirmed: true },
          ],
        },
        {
          1: { mark: 1, role: role5 },
          2: { mark: 1, role: role6 },
        }
      )

      expect(planOfficialConsecutive11.periods[0].endDate).toBe("2027-04-01")
      expect(planOfficialConsecutive11.periods[1].startDate).toBe("2027-04-02")
      expect(planOfficialConsecutive11.periods[0].allowed).toBe(true)
      expect(planOfficialConsecutive11.periods[1].allowed).toBe(true)
      expect(planOfficialConsecutive11.isValidPlan).toBe(true)

      // Caso C: Continuidad inmediata en modalidad 2->3 (20 días + 15 días: Rol 5 termina 2027-04-15, Rol 7 inicia 2027-04-16)
      const planOfficialConsecutive23 = buildVacationPlan(
        {
          ...semestralInput,
          calendar: VACATION_CALENDAR_2027,
          entitlements: [
            { id: "p1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-06-15", confirmed: true },
            { id: "p2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-07-15", confirmed: true },
          ],
        },
        {
          1: { mark: 2, role: role5 },
          2: { mark: 3, role: role7 },
        }
      )

      expect(planOfficialConsecutive23.periods[0].endDate).toBe("2027-04-15")
      expect(planOfficialConsecutive23.periods[1].startDate).toBe("2027-04-19")
      expect(planOfficialConsecutive23.periods[0].allowed).toBe(true)
      expect(planOfficialConsecutive23.periods[1].allowed).toBe(true)
      expect(planOfficialConsecutive23.isValidPlan).toBe(true)
    })

    it("5) Período 1 diferido hacia adelante después de programar Período 2 -> recalcula e invalida Período 2 sin permitir inversión", () => {
      // Inicialmente P1 en enero y P2 en febrero -> válido
      const initialSelections = {
        1: { mark: 1, role: roleJan },
        2: { mark: 1, role: roleFeb },
      }
      const validPlan = buildVacationPlan(semestralInput, initialSelections)
      expect(validPlan.isValidPlan).toBe(true)

      // El trabajador difiere P1 hacia marzo mientras P2 sigue en febrero
      const deferredSelections = {
        ...initialSelections,
        1: { mark: 1, role: roleMar },
      }
      const recalculatedPlan = buildVacationPlan(semestralInput, deferredSelections)

      expect(recalculatedPlan.periods[0].allowed).toBe(true)
      expect(recalculatedPlan.periods[1].allowed).toBe(false)
      expect(recalculatedPlan.periods[1].eligibility?.reasonCode).toBe("PERIOD_SEQUENCE_INVERTED")
      expect(recalculatedPlan.periods[1].reasons).toContain(PERIOD_SEQUENCE_INVERTED_MESSAGE)
      expect(recalculatedPlan.isValidPlan).toBe(false)
    })

    it("6) Personal cuatrimestral por emanaciones radiactivas: 3 periodos ordinarios con anticipación de 105 días y marcas 2->5->5 sin mezclar con semestral", () => {
      const cuatrimestralProfile: WorkerProfile = {
        contractType: "BASE",
        effectiveSeniority: { years: 10, fortnights: 0, days: 0 },
        radiologicalExposure: true,
        weeklyRestDays: [0, 6],
      }

      const cuatRole1: VacationRole = { id: "c1", roleNumber: 1, startDate: "2027-02-01", endDate: "2027-02-10", enabled: true }
      const cuatRole2: VacationRole = { id: "c2", roleNumber: 2, startDate: "2027-06-01", endDate: "2027-06-10", enabled: true }
      const cuatRole3: VacationRole = { id: "c3", roleNumber: 3, startDate: "2027-10-01", endDate: "2027-10-10", enabled: true }

      const cuatInput: VacationPlanInput = {
        workerProfile: cuatrimestralProfile,
        regime: "CUATRIMESTRAL",
        initialContinuity: 0,
        entitlements: [
          { id: "c-p1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-04-15", confirmed: true },
          { id: "c-p2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-08-15", confirmed: true },
          { id: "c-p3", kind: "ORDINARY", periodNumber: 3, dueDate: "2027-12-15", confirmed: true },
        ],
        calendar: {
          id: "cal-cuat",
          year: 2027,
          version: "v1",
          status: "PUBLISHED",
          sourceName: "IMSS",
          roles: [cuatRole1, cuatRole2, cuatRole3],
        },
        integratedMonthlySalary: 30000,
      }

      // Secuencia progresiva válida 2 -> 5 -> 5 (abre en 4 -> intermedia en 9 -> cierra en 14)
      const validCuatPlan = buildVacationPlan(cuatInput, {
        1: { mark: 2, role: cuatRole1 },
        2: { mark: 5, role: cuatRole2 },
        3: { mark: 5, role: cuatRole3 },
      })

      expect(validCuatPlan.periods).toHaveLength(3)
      expect(validCuatPlan.periods[0].stage).toBe("CUATRIMESTRAL_SEQUENCE_B")
      expect(validCuatPlan.periods[0].continuityAfter).toBe(4)
      expect(validCuatPlan.periods[1].continuityAfter).toBe(9)
      expect(validCuatPlan.periods[2].continuityAfter).toBe(14)
      expect(validCuatPlan.isValidPlan).toBe(true)

      // Si el Periodo 3 intenta programarse antes del Periodo 2 (ej. P2 en octubre y P3 en junio) -> bloqueado por secuencia
      const invertedCuatPlan = buildVacationPlan(cuatInput, {
        1: { mark: 2, role: cuatRole1 },
        2: { mark: 5, role: cuatRole3 }, // Octubre
        3: { mark: 5, role: cuatRole2 }, // Junio (antes de P2)
      })

      expect(invertedCuatPlan.periods[2].allowed).toBe(false)
      expect(invertedCuatPlan.periods[2].eligibility?.reasonCode).toBe("PERIOD_SEQUENCE_INVERTED")
      expect(invertedCuatPlan.periods[2].reasons).toContain(PERIOD_SEQUENCE_INVERTED_MESSAGE)
      expect(invertedCuatPlan.isValidPlan).toBe(false)
    })
  })
})
