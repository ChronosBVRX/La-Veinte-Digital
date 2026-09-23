import { describe, it, expect } from "vitest"
import { evaluateVacationAlternatives } from "../domain/alternative-evaluator"
import { getPriorityFeedback, getMarkGuidance } from "../domain/option-guidance"
import type { VacationPlanInput, WorkerProfile } from "../domain/types"

describe("Evaluador de Alternativas Vacacionales y Filtro de Compatibilidad", () => {
  const baseProfile: WorkerProfile = {
    contractType: "BASE",
    effectiveSeniority: { years: 10, fortnights: 0, days: 0 },
    weeklyRestDays: [0, 6],
  }

  const baseSemestralInput: VacationPlanInput = {
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

  describe("Régimen Semestral - Evaluación y Cierre de Ciclos Abiertos", () => {
    it("Continuidad 0 (inicio de ciclo): muestra modalidades canónicas completas (4->9, 1->1, 2->3)", () => {
      const input: VacationPlanInput = { ...baseSemestralInput, initialContinuity: 0 }
      const alts = evaluateVacationAlternatives(input)

      expect(alts.length).toBeGreaterThanOrEqual(3)

      const moreNow = alts.find((a) => a.id === "MORE_NOW")
      const splitPay = alts.find((a) => a.id === "SPLIT_PAY")
      const moreRest = alts.find((a) => a.id === "MORE_REST")

      expect(moreNow).toBeDefined()
      expect(moreNow?.status).toBe("AVAILABLE")
      expect(moreNow?.selectable).toBe(true)
      expect(moreNow?.badgeLabel).toBe("🟢 Compatible con tus datos")
      expect(moreNow?.isInformationalExample).toBe(false)
      expect(moreNow?.marks).toEqual([4, 9])
      expect(moreNow?.totalGross).toBeGreaterThan(0)
      expect(moreNow?.totalCulturalHelp048).toBeGreaterThan(0)

      expect(splitPay).toBeDefined()
      expect(splitPay?.status).toBe("AVAILABLE")
      expect(splitPay?.selectable).toBe(true)
      expect(splitPay?.marks).toEqual([1, 1])

      expect(moreRest).toBeDefined()
      expect(moreRest?.status).toBe("AVAILABLE")
      expect(moreRest?.selectable).toBe(true)
      expect(moreRest?.marks).toEqual([2, 3])
      expect(moreRest?.totalCulturalHelp048).toBe(0)
    })

    it("Continuidad 1: ÚNICAMENTE permite el cierre con Marca 1 (un solo periodo [1], sin iniciar ciclo nuevo)", () => {
      const input: VacationPlanInput = { ...baseSemestralInput, initialContinuity: 1 }
      const alts = evaluateVacationAlternatives(input)

      const splitPay = alts.find((a) => a.id === "SPLIT_PAY")
      const moreNow = alts.find((a) => a.id === "MORE_NOW")
      const moreRest = alts.find((a) => a.id === "MORE_REST")

      // La alternativa compatible representa ÚNICAMENTE el cierre del ciclo abierto con Marca 1
      expect(splitPay).toBeDefined()
      expect(splitPay?.status).toBe("AVAILABLE")
      expect(splitPay?.selectable).toBe(true)
      expect(splitPay?.badgeLabel).toBe("🟢 Compatible con tus datos")
      expect(splitPay?.marks).toEqual([1]) // Solo 1 periodo, NO [1, 1] ni [1, 0]
      expect(splitPay?.marks).toHaveLength(1)
      expect(splitPay?.p1Gross).toBeGreaterThan(0)
      expect(splitPay?.p2Gross).toBeNull() // No evalúa ni inventa segundo periodo en esta alternativa

      // Modalidades nuevas son estrictamente INCOMPATIBLES y NO seleccionables
      expect(moreNow?.status).toBe("INCOMPATIBLE")
      expect(moreNow?.selectable).toBe(false)
      expect(moreNow?.isInformationalExample).toBe(true)
      expect(moreNow?.badgeLabel).toBe("🔒 Incompatible con tu situación actual")

      expect(moreRest?.status).toBe("INCOMPATIBLE")
      expect(moreRest?.selectable).toBe(false)
    })

    it("Continuidad 3: ÚNICAMENTE permite el cierre con Marca 3 (un solo periodo [3], sin iniciar ciclo nuevo como 3->0)", () => {
      const input: VacationPlanInput = { ...baseSemestralInput, initialContinuity: 3 }
      const alts = evaluateVacationAlternatives(input)

      const moreRest = alts.find((a) => a.id === "MORE_REST")
      const moreNow = alts.find((a) => a.id === "MORE_NOW")
      const splitPay = alts.find((a) => a.id === "SPLIT_PAY")

      expect(moreRest?.status).toBe("AVAILABLE")
      expect(moreRest?.selectable).toBe(true)
      expect(moreRest?.marks).toEqual([3]) // Solo [3], NUNCA [3, 0]
      expect(moreRest?.marks).toHaveLength(1)
      expect(moreRest?.p1Gross).toBeGreaterThan(0)
      expect(moreRest?.p2Gross).toBeNull()

      expect(moreNow?.status).toBe("INCOMPATIBLE")
      expect(moreNow?.selectable).toBe(false)

      expect(splitPay?.status).toBe("INCOMPATIBLE")
      expect(splitPay?.selectable).toBe(false)
    })

    it("Continuidad 4: ÚNICAMENTE permite el cierre con Marca 9 (un solo periodo [9], sin iniciar ciclo nuevo como 9->4)", () => {
      const input: VacationPlanInput = { ...baseSemestralInput, initialContinuity: 4 }
      const alts = evaluateVacationAlternatives(input)

      const close4 = alts.find((a) => a.id === "MORE_NOW_CLOSE")
      const moreNow = alts.find((a) => a.id === "MORE_NOW")
      const splitPay = alts.find((a) => a.id === "SPLIT_PAY")

      expect(close4?.status).toBe("AVAILABLE")
      expect(close4?.selectable).toBe(true)
      expect(close4?.marks).toEqual([9]) // Solo [9], NUNCA [9, 4]
      expect(close4?.marks).toHaveLength(1)
      expect(close4?.p1Gross).toBeGreaterThan(0)
      expect(close4?.p2Gross).toBeNull()

      expect(moreNow?.status).toBe("INCOMPATIBLE")
      expect(moreNow?.selectable).toBe(false)

      expect(splitPay?.status).toBe("INCOMPATIBLE")
      expect(splitPay?.selectable).toBe(false)
    })

    it("Continuidad 9: ÚNICAMENTE permite el cierre con Marca 4 (un solo periodo [4], sin iniciar ciclo nuevo como 4->9)", () => {
      const input: VacationPlanInput = { ...baseSemestralInput, initialContinuity: 9 }
      const alts = evaluateVacationAlternatives(input)

      const deferredClose = alts.find((a) => a.id === "DEFERRED_HELP_CLOSE")
      const splitPay = alts.find((a) => a.id === "SPLIT_PAY")
      const moreRest = alts.find((a) => a.id === "MORE_REST")

      expect(deferredClose?.status).toBe("AVAILABLE")
      expect(deferredClose?.selectable).toBe(true)
      expect(deferredClose?.marks).toEqual([4]) // Solo [4], NUNCA [4, 9]
      expect(deferredClose?.marks).toHaveLength(1)
      expect(deferredClose?.p1Gross).toBeGreaterThan(0)
      expect(deferredClose?.p2Gross).toBeNull()

      expect(splitPay?.status).toBe("INCOMPATIBLE")
      expect(splitPay?.selectable).toBe(false)

      expect(moreRest?.status).toBe("INCOMPATIBLE")
      expect(moreRest?.selectable).toBe(false)
    })
  })

  describe("Régimen Cuatrimestral - Evaluación y Continuidad", () => {
    const baseCuatriInput: VacationPlanInput = {
      workerProfile: {
        ...baseProfile,
        radiologicalExposure: true,
      },
      regime: "CUATRIMESTRAL",
      initialContinuity: 0,
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2027-04-01", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-08-01", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "3", kind: "ORDINARY", periodNumber: 3, dueDate: "2027-12-01", confirmed: true, sourcePayslipPeriod: "2026-16" },
      ],
      calendar: null,
      integratedMonthlySalary: 30000,
    }

    it("Continuidad 0 (inicio de ciclo cuatrimestral): Permite opción regular 0->0->0 y fraccionada 2->5->5", () => {
      const input: VacationPlanInput = { ...baseCuatriInput, initialContinuity: 0 }
      const alts = evaluateVacationAlternatives(input)

      const regA = alts.find((a) => a.id === "REGULAR_A")
      const fracB = alts.find((a) => a.id === "FRACCIONADO_B")

      expect(regA?.status).toBe("AVAILABLE")
      expect(regA?.selectable).toBe(true)
      expect(regA?.marks).toEqual([0, 0, 0])

      expect(fracB?.status).toBe("AVAILABLE")
      expect(fracB?.selectable).toBe(true)
      expect(fracB?.marks).toEqual([2, 5, 5])
    })

    it("Continuidad 1 (secuencia regular iniciada): Requiere [0, 0] para cerrar y NO permite fraccionada", () => {
      const input: VacationPlanInput = { ...baseCuatriInput, initialContinuity: 1 }
      const alts = evaluateVacationAlternatives(input)

      const regA = alts.find((a) => a.id === "REGULAR_A")
      const fracB = alts.find((a) => a.id === "FRACCIONADO_B")

      expect(regA?.status).toBe("AVAILABLE")
      expect(regA?.selectable).toBe(true)
      expect(regA?.marks).toEqual([0, 0])

      expect(fracB?.status).toBe("INCOMPATIBLE")
      expect(fracB?.selectable).toBe(false)
      expect(fracB?.isInformationalExample).toBe(true)
    })

    it("Continuidad 2 (segundo periodo regular tomado): Requiere [0] para cerrar ciclo", () => {
      const input: VacationPlanInput = { ...baseCuatriInput, initialContinuity: 2 }
      const alts = evaluateVacationAlternatives(input)

      const regA = alts.find((a) => a.id === "REGULAR_A")
      expect(regA?.status).toBe("AVAILABLE")
      expect(regA?.marks).toEqual([0])
      expect(regA?.marks).toHaveLength(1)
    })

    it("Continuidad 4 (secuencia fraccionada iniciada con Marca 2): Requiere [5, 5] para cerrar y NO permite regular", () => {
      const input: VacationPlanInput = { ...baseCuatriInput, initialContinuity: 4 }
      const alts = evaluateVacationAlternatives(input)

      const fracB = alts.find((a) => a.id === "FRACCIONADO_B")
      const regA = alts.find((a) => a.id === "REGULAR_A")

      expect(fracB?.status).toBe("AVAILABLE")
      expect(fracB?.selectable).toBe(true)
      expect(fracB?.marks).toEqual([5, 5])

      expect(regA?.status).toBe("INCOMPATIBLE")
      expect(regA?.selectable).toBe(false)
    })

    it("Continuidad 9 (segundo periodo fraccionado tomado con Marca 5): Requiere [5] para cerrar ciclo", () => {
      const input: VacationPlanInput = { ...baseCuatriInput, initialContinuity: 9 }
      const alts = evaluateVacationAlternatives(input)

      const fracB = alts.find((a) => a.id === "FRACCIONADO_B")
      expect(fracB?.status).toBe("AVAILABLE")
      expect(fracB?.marks).toEqual([5])
      expect(fracB?.marks).toHaveLength(1)
    })
  })

  describe("Orientación de Prioridades y Semántica de Lenguaje", () => {
    it("getPriorityFeedback advierte con empatía cuando la preferencia no coincide con la continuidad", () => {
      const feedback = getPriorityFeedback("MORE_NOW", 1, "SEMESTRAL", [1])
      expect(feedback.matched).toBe(false)
      expect(feedback.suggestedMark).toBe(1)
      expect(feedback.message).toContain("Marca 1")
      expect(feedback.message).toContain("no permite iniciar la modalidad de Marca 4")
    })

    it("getPriorityFeedback confirma cuando la preferencia es compatible", () => {
      const feedback = getPriorityFeedback("MORE_NOW", 0, "SEMESTRAL", [0, 1, 2, 4, 9])
      expect(feedback.matched).toBe(true)
      expect(feedback.suggestedMark).toBe(4)
    })

    it("getMarkGuidance(4) no realiza afirmaciones absolutas universales", () => {
      const g4 = getMarkGuidance(4, "SEMESTRAL")
      expect(g4.plainSummary).toContain("cuando esta modalidad está disponible")
      expect(g4.plainSummary).not.toMatch(/^Esta marca paga toda la ayuda en este periodo sin importar/)
    })
  })
})
