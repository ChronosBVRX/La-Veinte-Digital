// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import {
  getVacationContinuityGuidance,
  getIncompatibleReason,
  getCuatrimestralOptionSequences,
} from "../domain/option-guidance"
import {
  getCompatibleInclusionMarks,
  applyInclusionMark,
} from "../domain/continuity"
import { calculateVacationPayment } from "../domain/payment-estimate"
import { buildVacationPlan } from "../domain/annual-plan"
import type { VacationPlanInput } from "../domain/types"

describe("Lógica Normativa del Asesor: Separación de Regímenes y Reglas Móviles", () => {
  it("continuidad 1 semestral produce explicación semestral con marca 1", () => {
    const semestralGuide = getVacationContinuityGuidance("SEMESTRAL", 1)

    expect(semestralGuide.regime).toBe("SEMESTRAL")
    expect(semestralGuide.continuity).toBe(1)
    expect(semestralGuide.whatItMeans).toContain("primera fracción")
    expect(semestralGuide.whatItMeans).toContain("mitad de la ayuda")
    expect(semestralGuide.allowedMarks).toEqual([1])
    expect(semestralGuide.allowedMarksExplanation).toContain("marca 1")
  })

  it("continuidad 1 cuatrimestral produce explicación cuatrimestral con marca 0", () => {
    const cuatrimestralGuide = getVacationContinuityGuidance("CUATRIMESTRAL", 1)

    expect(cuatrimestralGuide.regime).toBe("CUATRIMESTRAL")
    expect(cuatrimestralGuide.continuity).toBe(1)
    expect(cuatrimestralGuide.whatItMeans).toContain("opción A")
    expect(cuatrimestralGuide.whatItMeans).toContain("cuatrimestrales")
    expect(cuatrimestralGuide.allowedMarks).toEqual([0])
    expect(cuatrimestralGuide.allowedMarksExplanation).toContain("marca 0")
    // Verifica que NO mencione la explicación semestral de cerrar con marca 1
    expect(cuatrimestralGuide.whatItMeans).not.toContain("primera fracción (marca 1)")
  })

  it("una marca no permitida utiliza el motivo del régimen correcto", () => {
    // Para un trabajador cuatrimestral con continuidad 1, la marca 2 debe dar motivo cuatrimestral
    const reasonCuatriMark2 = getIncompatibleReason(2, 1, "CUATRIMESTRAL")
    expect(reasonCuatriMark2).toContain("opción A")
    expect(reasonCuatriMark2.toLowerCase()).toContain("no puedes cambiar a la opción b")
    expect(reasonCuatriMark2).not.toContain("Debes cerrarla con otra marca 1")

    // Para un trabajador semestral con continuidad 1, la marca 2 debe advertir sobre la primera fracción
    const reasonSemestralMark2 = getIncompatibleReason(2, 1, "SEMESTRAL")
    expect(reasonSemestralMark2).toContain("primera fracción (marca 1)")
    expect(reasonSemestralMark2).toContain("cerrarla con otra marca 1")

    // Para cuatrimestral en continuidad 4 (opción B periodo 2), marca 0 no es válida
    const reasonCuatriMark0InCont4 = getIncompatibleReason(0, 4, "CUATRIMESTRAL")
    expect(reasonCuatriMark0InCont4).toContain("opción B")
    expect(reasonCuatriMark0InCont4).toContain("marca 5")
  })

  it("secuencia cuatrimestral A completa: marcas 0 -> 0 -> 0 con transiciones exactas", () => {
    const seq = getCuatrimestralOptionSequences()
    expect(seq.optionA.marks).toEqual([0, 0, 0])

    // Periodo 1: desde continuidad 0 con marca 0 -> continuidad 1
    const t1 = applyInclusionMark("CUATRIMESTRAL", 0, 0)
    expect("nextContinuity" in t1 && t1.nextContinuity).toBe(1)

    // Periodo 2: desde continuidad 1 con marca 0 -> continuidad 2
    const t2 = applyInclusionMark("CUATRIMESTRAL", 1, 0)
    expect("nextContinuity" in t2 && t2.nextContinuity).toBe(2)

    // Periodo 3: desde continuidad 2 con marca 0 -> continuidad 3 (cerrado)
    const t3 = applyInclusionMark("CUATRIMESTRAL", 2, 0)
    expect("nextContinuity" in t3 && t3.nextContinuity).toBe(3)
  })

  it("secuencia cuatrimestral B completa: marcas 2 -> 5 -> 5 con transiciones exactas", () => {
    const seq = getCuatrimestralOptionSequences()
    expect(seq.optionB.marks).toEqual([2, 5, 5])

    // Periodo 1: desde continuidad 0 con marca 2 -> continuidad 4
    const t1 = applyInclusionMark("CUATRIMESTRAL", 0, 2)
    expect("nextContinuity" in t1 && t1.nextContinuity).toBe(4)

    // Periodo 2: desde continuidad 4 con marca 5 -> continuidad 9
    const t2 = applyInclusionMark("CUATRIMESTRAL", 4, 5)
    expect("nextContinuity" in t2 && t2.nextContinuity).toBe(9)

    // Periodo 3: desde continuidad 9 con marca 5 -> continuidad 14 (cerrado)
    const t3 = applyInclusionMark("CUATRIMESTRAL", 9, 5)
    expect("nextContinuity" in t3 && t3.nextContinuity).toBe(14)
  })

  it("los importes y pagos corresponden a cada marca según su régimen", () => {
    const smi = 30000 // SDI = 1,000

    // Cuatrimestral Marca 0 para 5 años: 10 días, prima 029 = 1000 * 10 * 0.25 = 2,500; ayuda 048 = 1000 * 12.6 = 12,600
    const cuatriPay0 = calculateVacationPayment({
      integratedMonthlySalary: smi,
      daysOrUnits: 10,
      seniorityYears: 5,
      mark: 0,
      radiologicalExposure: true,
      regime: "CUATRIMESTRAL",
    })
    expect(cuatriPay0.premium029).toBe(2500)
    expect(cuatriPay0.culturalHelp048).toBe(12600)
    expect(cuatriPay0.grossVacationExtra).toBe(15100)
    expect(cuatriPay0.helpDays).toBe(12.6)

    // Cuatrimestral Marca 2 (Opción B): sin ayuda 048
    const cuatriPay2 = calculateVacationPayment({
      integratedMonthlySalary: smi,
      daysOrUnits: 10,
      seniorityYears: 5,
      mark: 2,
      radiologicalExposure: true,
      regime: "CUATRIMESTRAL",
    })
    expect(cuatriPay2.premium029).toBe(2500)
    expect(cuatriPay2.culturalHelp048).toBe(0)
    expect(cuatriPay2.grossVacationExtra).toBe(2500)

    // Semestral Marca 1 (50% ayuda): ayuda para 5 años = 31 días -> 50% = 15.5 días -> $15,500
    const semestralPay1 = calculateVacationPayment({
      integratedMonthlySalary: smi,
      daysOrUnits: 10,
      seniorityYears: 5,
      mark: 1,
      radiologicalExposure: false,
      regime: "SEMESTRAL",
    })
    expect(semestralPay1.premium029).toBe(2500)
    expect(semestralPay1.culturalHelp048).toBe(15500)
    expect(semestralPay1.grossVacationExtra).toBe(18000)
  })

  it("la continuidad resultante coincide con el motor al construir el plan anual", () => {
    const planInput: VacationPlanInput = {
      workerProfile: {
        contractType: "BASE",
        effectiveSeniority: { years: 5, fortnights: 0, days: 0 },
        weeklyRestDays: [0, 6],
      },
      regime: "SEMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2026-10-14", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, confirmed: false, sourcePayslipPeriod: "2026-16" },
      ],
      calendar: null,
      integratedMonthlySalary: 30000,
    }

    // Seleccionamos Marca 1 en periodo 1
    const planP1 = buildVacationPlan(planInput, {
      1: { mark: 1 },
    })
    expect(planP1.periods[0].continuityBefore).toBe(0)
    expect(planP1.periods[0].continuityAfter).toBe(1)
    expect(planP1.periods[1].continuityBefore).toBe(1)

    // Ahora en periodo 2 el motor solo permite marca 1
    const allowedP2 = getCompatibleInclusionMarks("SEMESTRAL", planP1.periods[1].continuityBefore!)
    expect(allowedP2).toEqual([1])

    const planP2 = buildVacationPlan(planInput, {
      1: { mark: 1 },
      2: { mark: 1 },
    })
    expect(planP2.periods[1].continuityAfter).toBe(2)
    expect(planP2.periods[0].allowed).toBe(true)
    expect(planP2.periods[1].allowed).toBe(true)
  })
})
