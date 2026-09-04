import { describe, it, expect } from "vitest"
import {
  getRadiationCulturalHelpDays,
  getRadiationDaysForPeriod,
  getCctCulturalHelpDays,
} from "../domain/entitlement"
import { calculateVacationPayment } from "../domain/payment-estimate"
import { getMarkGuidance, getIncompatibleReason } from "../domain/option-guidance"

describe("Cálculo Cuatrimestral 029 y 048 — Procedimiento IMSS 1A74-003-025 Anexo 1", () => {
  describe("Tabla de Unidades de Ayuda Cultural 048 por Antigüedad", () => {
    it("devuelve los días exactos para cada año sin redondeos artificiales", () => {
      expect(getRadiationCulturalHelpDays(1)).toBe(8.6)
      expect(getRadiationCulturalHelpDays(2)).toBe(9.3)
      expect(getRadiationCulturalHelpDays(3)).toBe(10.6)
      expect(getRadiationCulturalHelpDays(4)).toBe(11.3)
      expect(getRadiationCulturalHelpDays(5)).toBe(12.6)
      expect(getRadiationCulturalHelpDays(6)).toBe(13.3)
      expect(getRadiationCulturalHelpDays(14)).toBe(13.3)
    })
  })

  describe("Tabla de Días de Descanso por Periodo para Régimen Cuatrimestral", () => {
    it("asigna los días correctos por periodo según la antigüedad sin desfase de 1 año", () => {
      // 1 año: 7, 8, 7
      expect(getRadiationDaysForPeriod(1, 0)).toBe(7)
      expect(getRadiationDaysForPeriod(1, 1)).toBe(8)
      expect(getRadiationDaysForPeriod(1, 2)).toBe(7)

      // 2 años: 8, 8, 8
      expect(getRadiationDaysForPeriod(2, 0)).toBe(8)
      expect(getRadiationDaysForPeriod(2, 1)).toBe(8)
      expect(getRadiationDaysForPeriod(2, 2)).toBe(8)

      // 3 años: 8, 9, 8
      expect(getRadiationDaysForPeriod(3, 0)).toBe(8)
      expect(getRadiationDaysForPeriod(3, 1)).toBe(9)
      expect(getRadiationDaysForPeriod(3, 2)).toBe(8)

      // 4 años: 9, 9, 9
      expect(getRadiationDaysForPeriod(4, 0)).toBe(9)
      expect(getRadiationDaysForPeriod(4, 1)).toBe(9)
      expect(getRadiationDaysForPeriod(4, 2)).toBe(9)

      // 5 años: 9, 10, 9
      expect(getRadiationDaysForPeriod(5, 0)).toBe(9)
      expect(getRadiationDaysForPeriod(5, 1)).toBe(10)
      expect(getRadiationDaysForPeriod(5, 2)).toBe(9)

      // Más de 5 años: 10, 10, 10
      expect(getRadiationDaysForPeriod(6, 0)).toBe(10)
      expect(getRadiationDaysForPeriod(6, 1)).toBe(10)
      expect(getRadiationDaysForPeriod(6, 2)).toBe(10)

      expect(getRadiationDaysForPeriod(14, 0)).toBe(10)
      expect(getRadiationDaysForPeriod(14, 1)).toBe(10)
      expect(getRadiationDaysForPeriod(14, 2)).toBe(10)
    })
  })

  describe("Caso de Regresión Obligatorio — Técnico Radiólogo 14 años", () => {
    it("calcula prima 029 de $1,838.22 y ayuda 048 de $9,779.31 con 13.3 unidades, no $22,793.89", () => {
      const result = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 0,
        daysOrUnits: 10,
      })

      // Verificación de tolerancia contra el cálculo exacto de nómina
      expect(result.premium029).toBeCloseTo(1838.22, 2)
      expect(result.culturalHelp048).toBeCloseTo(9779.31, 2)
      expect(result.grossVacationExtra).toBeCloseTo(11617.53, 2)

      // Aserción explícita obligatoria: NO debe ser $22,793.89 (tabla semestral de 31 días)
      expect(result.culturalHelp048).not.toBeCloseTo(22793.89, 2)
      expect(result.helpDays).toBe(13.3)
    })

    it("marca 0 calcula correctamente los tres periodos cuatrimestrales", () => {
      const p1 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 0,
        daysOrUnits: 10,
      })
      const p2 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 0,
        daysOrUnits: 10,
      })
      const p3 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 0,
        daysOrUnits: 10,
      })

      expect(p1.culturalHelp048).toBeCloseTo(9779.31, 2)
      expect(p2.culturalHelp048).toBeCloseTo(9779.31, 2)
      expect(p3.culturalHelp048).toBeCloseTo(9779.31, 2)
      expect(p1.helpDays).toBe(13.3)
      expect(p2.helpDays).toBe(13.3)
      expect(p3.helpDays).toBe(13.3)
    })

    it("secuencia 2 -> 5 -> 5 (modalidad fraccionada cuatrimestral) no liquida concepto 048", () => {
      const p1 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 2,
        daysOrUnits: 10,
      })
      const p2 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 5,
        daysOrUnits: 10,
      })
      const p3 = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "CUATRIMESTRAL",
        radiologicalExposure: true,
        mark: 5,
        daysOrUnits: 10,
      })

      expect(p1.premium029).toBeCloseTo(1838.22, 2)
      expect(p1.culturalHelp048).toBe(0)
      expect(p1.grossVacationExtra).toBeCloseTo(1838.22, 2)

      expect(p2.premium029).toBeCloseTo(1838.22, 2)
      expect(p2.culturalHelp048).toBe(0)
      expect(p2.grossVacationExtra).toBeCloseTo(1838.22, 2)

      expect(p3.premium029).toBeCloseTo(1838.22, 2)
      expect(p3.culturalHelp048).toBe(0)
      expect(p3.grossVacationExtra).toBeCloseTo(1838.22, 2)
    })

    it("trabajador semestral de 14 años conserva la tabla general de 31 días", () => {
      const semestralResult = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 14,
        regime: "SEMESTRAL",
        radiologicalExposure: false,
        mark: 0,
        daysOrUnits: 20,
      })

      expect(getCctCulturalHelpDays(14)).toBe(31)
      expect(semestralResult.helpDays).toBe(31)
      expect(semestralResult.culturalHelp048).toBeCloseTo(22793.89, 2)
    })

    it("periodo extraordinario V20 genera prima vacacional sin ayuda 048", () => {
      const v20Result = calculateVacationPayment({
        integratedMonthlySalary: 22058.60,
        seniorityYears: 20,
        regime: "EXTRAORDINARIO_V20",
        isV20: true,
        mark: 6,
        daysOrUnits: 15,
      })

      expect(v20Result.premium029).toBeCloseTo(2757.33, 2)
      expect(v20Result.culturalHelp048).toBe(0)
      expect(v20Result.grossVacationExtra).toBeCloseTo(2757.33, 2)
    })

    it("el régimen cuatrimestral no reutiliza mensajes semestrales", () => {
      const cuatriMark2Reason = getIncompatibleReason(2, 1, "CUATRIMESTRAL")
      expect(cuatriMark2Reason).not.toContain("Debes cerrarla con otra marca 1")
      expect(cuatriMark2Reason).not.toContain("primera fracción (marca 1)")

      const guidanceMark0 = getMarkGuidance(0, "CUATRIMESTRAL")
      expect(guidanceMark0.title).toContain("Marca 0")
      expect(guidanceMark0.plainSummary).not.toContain("31 días")
    })
  })
})
