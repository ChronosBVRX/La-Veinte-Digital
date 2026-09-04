import { describe, it, expect } from "vitest"
import {
  calculateVacationPayment,
  calculateAnnualTotals,
  formatMexicanCurrency,
} from "../domain/payment-estimate"

describe("Motor Económico de Vacaciones (Conceptos 029 y 048)", () => {
  const SMI_30K = 30000

  it("Calcula correctamente con caso base SMI = $30,000 (Salario Diario = $1,000)", () => {
    // 16 días de vacaciones y 5 años de antigüedad (31 días de ayuda)
    const res = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 16,
      seniorityYears: 5,
      mark: 0,
      regime: "SEMESTRAL",
    })

    expect(res.dailyIntegratedSalary).toBe(1000)
    // 029 = 1,000 * 16 * 0.25 = 4,000
    expect(res.premium029).toBe(4000)
    // 048 = 1,000 * 31 * 1.0 = 31,000
    expect(res.culturalHelp048).toBe(31000)
    // Total adicional bruto = 4,000 + 31,000 = 35,000
    expect(res.grossVacationExtra).toBe(35000)
    expect(res.confidence).toBe("CONFIRMED")
  })

  it("Marca 1 fraccionada: paga prima de la fracción y la mitad de la ayuda (50%)", () => {
    // 8 días de vacaciones (primera fracción de 16) y 31 días de ayuda
    const res = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 1,
      regime: "SEMESTRAL",
    })

    expect(res.dailyIntegratedSalary).toBe(1000)
    // 029 = 1,000 * 8 * 0.25 = 2,000
    expect(res.premium029).toBe(2000)
    // 048 = 1,000 * 31 * 0.5 = 15,500
    expect(res.culturalHelp048).toBe(15500)
    expect(res.grossVacationExtra).toBe(17500)
    expect(res.helpPaymentFraction).toBe(0.5)
  })

  it("Secuencia 2→3: cobra prima de los días pero no paga ayuda cultural 048", () => {
    // Marca 2
    const res2 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 2,
      regime: "SEMESTRAL",
    })
    expect(res2.premium029).toBe(2000)
    expect(res2.culturalHelp048).toBe(0)
    expect(res2.grossVacationExtra).toBe(2000)
    expect(res2.helpPaymentFraction).toBe(0)

    // Marca 3
    const res3 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 3,
      regime: "SEMESTRAL",
    })
    expect(res3.premium029).toBe(2000)
    expect(res3.culturalHelp048).toBe(0)
    expect(res3.grossVacationExtra).toBe(2000)
  })

  it("Secuencia 4→9: marca 4 paga 100% de la ayuda y marca 9 paga 0%", () => {
    const res4 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 4,
      regime: "SEMESTRAL",
    })
    expect(res4.premium029).toBe(2000)
    expect(res4.culturalHelp048).toBe(31000)
    expect(res4.grossVacationExtra).toBe(33000)
    expect(res4.helpPaymentFraction).toBe(1)

    const res9 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 9,
      regime: "SEMESTRAL",
    })
    expect(res9.premium029).toBe(2000)
    expect(res9.culturalHelp048).toBe(0)
    expect(res9.grossVacationExtra).toBe(2000)
    expect(res9.helpPaymentFraction).toBe(0)
  })

  it("Secuencia 9→4: marca 9 difiere la ayuda (0%) y marca 4 la paga completa (100%)", () => {
    const res9 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 9,
      regime: "SEMESTRAL",
    })
    expect(res9.culturalHelp048).toBe(0)

    const res4 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 4,
      regime: "SEMESTRAL",
    })
    expect(res4.culturalHelp048).toBe(31000)
  })

  it("Periodo extraordinario V20: paga prima vacacional de sus días pero no genera ayuda 048", () => {
    const resV20 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 15,
      seniorityYears: 20,
      mark: 6,
      regime: "EXTRAORDINARIO_V20",
      isV20: true,
    })
    expect(resV20.premium029).toBe(3750) // 1,000 * 15 * 0.25
    expect(resV20.culturalHelp048).toBe(0)
    expect(resV20.grossVacationExtra).toBe(3750)
  })

  it("SMI faltante o incompleto devuelve confidence INCOMPLETE sin cifras inventadas", () => {
    const resNull = calculateVacationPayment({
      integratedMonthlySalary: null,
      daysOrUnits: 16,
      seniorityYears: 5,
    })
    expect(resNull.confidence).toBe("INCOMPLETE")
    expect(resNull.dailyIntegratedSalary).toBeNull()
    expect(resNull.premium029).toBeNull()
    expect(resNull.culturalHelp048).toBeNull()
    expect(resNull.grossVacationExtra).toBeNull()
    expect(resNull.warnings.length).toBeGreaterThan(0)
  })

  it("Suma correctamente los totales anuales de varios periodos", () => {
    const p1 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 4,
    })
    const p2 = calculateVacationPayment({
      integratedMonthlySalary: SMI_30K,
      daysOrUnits: 8,
      seniorityYears: 5,
      mark: 9,
    })

    const totals = calculateAnnualTotals([p1, p2])
    expect(totals.totalPremium029).toBe(4000)
    expect(totals.totalCulturalHelp048).toBe(31000)
    expect(totals.totalGrossVacationExtra).toBe(35000)
    expect(totals.allComplete).toBe(true)
  })

  it("Formato monetario mexicano correcto", () => {
    expect(formatMexicanCurrency(35000)).toMatch(/\$35,000\.00/)
    expect(formatMexicanCurrency(null)).toBe("$—")
  })
})
