import { describe, it, expect } from "vitest"
import { calculateSalaryIncrease } from "../lib/calculate-salary-increase"

describe("calculateSalaryIncrease", () => {
  it("1. tarjetón válido: ejemplo de control 10000 + 8215 → 929.55", () => {
    const r = calculateSalaryIncrease({ tabular: 10000, concept11: 8215, hasPayslip: true })
    expect(r.calculationStatus).toBe("ok")
    expect(r.currentTabular).toBe(10000)
    expect(r.currentConcept11).toBe(8215)
    expect(r.estimatedTabular).toBeCloseTo(10290, 10)
    expect(r.estimatedConcept11).toBeCloseTo(8854.545, 10)
    expect(r.estimatedFortnightlyIncrease).toBe(929.55)
  })

  it("2. se actualiza al importar un tarjetón más reciente", () => {
    const antes = calculateSalaryIncrease({ tabular: 10000, concept11: 8215, hasPayslip: true })
    const despues = calculateSalaryIncrease({ tabular: 10500, concept11: 8625.75, hasPayslip: true })
    expect(despues.calculationStatus).toBe("ok")
    expect(despues.estimatedFortnightlyIncrease).not.toBe(antes.estimatedFortnightlyIncrease)
    expect(despues.estimatedFortnightlyIncrease).toBeGreaterThan(antes.estimatedFortnightlyIncrease)
  })

  it("3. sin tarjetón: no muestra cifras", () => {
    const r = calculateSalaryIncrease({ tabular: 10000, concept11: 8215, hasPayslip: false })
    expect(r.calculationStatus).toBe("missing-payslip")
    expect(r.estimatedFortnightlyIncrease).toBe(0)
  })

  it("4. sueldo tabular faltante", () => {
    expect(calculateSalaryIncrease({ tabular: undefined, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: null, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: 0, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("invalid")
  })

  it("5. Concepto 11 faltante no se calcula en silencio", () => {
    const r = calculateSalaryIncrease({ tabular: 10000, concept11: undefined, hasPayslip: true })
    expect(r.calculationStatus).toBe("missing-concept11")
    expect(r.estimatedFortnightlyIncrease).toBe(0)
  })

  it("6. importes con $, comas y espacios se normalizan", () => {
    const r = calculateSalaryIncrease({ tabular: "$10,000.00", concept11: "8,215.00", hasPayslip: true })
    expect(r.calculationStatus).toBe("ok")
    expect(r.estimatedFortnightlyIncrease).toBe(929.55)
    const spaced = calculateSalaryIncrease({ tabular: "1 000.50", concept11: 0, hasPayslip: true })
    expect(spaced.calculationStatus).toBe("ok")
    expect(spaced.currentTabular).toBe(1000.5)
  })

  it("7. negativos, NaN, Infinity y cadenas inválidas se rechazan", () => {
    expect(calculateSalaryIncrease({ tabular: -100, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("invalid")
    expect(calculateSalaryIncrease({ tabular: 10000, concept11: -1, hasPayslip: true }).calculationStatus).toBe("invalid")
    expect(calculateSalaryIncrease({ tabular: NaN, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: Infinity, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: "abc", concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
  })

  it("8. redondeo a dos decimales solo en el resultado final", () => {
    const r = calculateSalaryIncrease({ tabular: 100, concept11: 0, hasPayslip: true })
    // 102.9 + 88.54545 - 100 = 91.44545 → 91.45
    expect(r.estimatedFortnightlyIncrease).toBe(91.45)
    expect(Number.isInteger(r.estimatedFortnightlyIncrease * 100)).toBe(true)
  })

  it("9. la Cláusula 157 no forma parte del aumento quincenal", () => {
    const r = calculateSalaryIncrease({ tabular: 10000, concept11: 8215, hasPayslip: true })
    expect(r).not.toHaveProperty("clausula157")
    expect(r).not.toHaveProperty("concept157")
    // El resultado equivale exactamente a la fórmula sin ningún sumando extra.
    expect(r.estimatedFortnightlyIncrease).toBe(929.55)
  })
})
