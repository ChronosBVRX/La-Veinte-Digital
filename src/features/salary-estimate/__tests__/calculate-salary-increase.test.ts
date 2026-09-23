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
    const spaced = calculateSalaryIncrease({ tabular: "1 000.50", concept11: " 821.50 ", hasPayslip: true })
    expect(spaced.calculationStatus).toBe("ok")
    expect(spaced.currentTabular).toBe(1000.5)
    expect(spaced.currentConcept11).toBe(821.5)
  })

  it("7. negativos, NaN, Infinity y cadenas inválidas se rechazan", () => {
    expect(calculateSalaryIncrease({ tabular: -100, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("invalid")
    expect(calculateSalaryIncrease({ tabular: 10000, concept11: -1, hasPayslip: true }).calculationStatus).toBe("invalid")
    expect(calculateSalaryIncrease({ tabular: NaN, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: Infinity, concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
    expect(calculateSalaryIncrease({ tabular: "abc", concept11: 8215, hasPayslip: true }).calculationStatus).toBe("missing-tabular")
  })

  it("8. redondeo a dos decimales solo en el resultado final", () => {
    const r = calculateSalaryIncrease({ tabular: 100, concept11: 10, hasPayslip: true })
    // 102.9 + 88.54545 - 100 - 10 = 81.44545 → 81.45
    expect(r.estimatedFortnightlyIncrease).toBe(81.45)
    expect(Number.isInteger(r.estimatedFortnightlyIncrease * 100)).toBe(true)
  })

  it("9. la Cláusula 157 no forma parte del aumento quincenal", () => {
    const r = calculateSalaryIncrease({ tabular: 10000, concept11: 8215, hasPayslip: true })
    expect(r).not.toHaveProperty("clausula157")
    expect(r).not.toHaveProperty("concept157")
    // El resultado equivale exactamente a la fórmula sin ningún sumando extra.
    expect(r.estimatedFortnightlyIncrease).toBe(929.55)
  })

  it("10. caso sintético sustitución: calcula estimación sobre sueldo sustituto 008 para su cobertura quincenal", () => {
    // 3,200.00 * 1.029 = 3292.8
    // 3292.8 * 0.8605 = 2833.4544
    // 3292.8 + 2833.4544 - 3200.00 - 2600.00 = 326.2544 → 326.25
    const r = calculateSalaryIncrease({
      substituteSalary: 3200,
      salaryType: "substitute",
      concept11: 2600,
      hasPayslip: true,
      substituteCoverage: "unknown",
    })
    expect(r.calculationStatus).toBe("ok")
    expect(r.salaryType).toBe("substitute")
    expect(r.currentTabular).toBe(3200)
    expect(r.currentConcept11).toBe(2600)
    expect(r.estimatedFortnightlyIncrease).toBe(326.25)
    expect(r.isPartialCoverage).toBe(true)
    expect(r.substituteCoverage).toBe("unknown")
  })

  it("11. caso sintético ordinario: calcula estimación ordinaria sobre 002 y 011", () => {
    // 4000.00 * 1.029 = 4116.00
    // 4116.00 * 0.8605 = 3541.818
    // 4116.00 + 3541.818 - 4000.00 - 3200.00 = 457.818 → 457.82
    const r = calculateSalaryIncrease({
      tabular: 4000,
      salaryType: "base",
      concept11: 3200,
      hasPayslip: true,
    })
    expect(r.calculationStatus).toBe("ok")
    expect(r.salaryType).toBe("base")
    expect(r.currentTabular).toBe(4000)
    expect(r.currentConcept11).toBe(3200)
    expect(r.estimatedFortnightlyIncrease).toBe(457.82)
    expect(r.isPartialCoverage).toBe(false)
  })

  it("11b. caso sintético de control: cálculo ordinario preciso con importes de referencia", () => {
    // 3800.00 * 1.029 = 3910.2
    // 3910.2 * 0.8605 = 3364.7271
    // 3910.2 + 3364.7271 - 3800.00 - 3100.00 = 374.9271 → 374.93
    const r = calculateSalaryIncrease({
      tabular: 3800,
      salaryType: "base",
      concept11: 3100,
      hasPayslip: true,
    })
    expect(r.calculationStatus).toBe("ok")
    expect(r.salaryType).toBe("base")
    expect(r.currentTabular).toBe(3800)
    expect(r.currentConcept11).toBe(3100)
    expect(r.estimatedFortnightlyIncrease).toBe(374.93)
    expect(r.isPartialCoverage).toBe(false)
  })

  it("11c. concepto 011 igual a cero ($0.00 confirmado) se conserva como dato del recibo pero se marca como pendiente de comprobar sin incremento desde cero", () => {
    const r = calculateSalaryIncrease({
      tabular: 4000,
      salaryType: "base",
      concept11: 0,
      hasPayslip: true,
    })
    expect(r.calculationStatus).toBe("unverified-comparable-base")
    expect(r.currentTabular).toBe(4000)
    expect(r.currentConcept11).toBe(0)
    expect(r.estimatedConcept11).toBe(0)
    expect(r.estimatedFortnightlyIncrease).toBe(0)

    // En contraste, concepto 11 undefined o ausente devuelve missing-concept11
    const rMissing = calculateSalaryIncrease({
      tabular: 4000,
      salaryType: "base",
      concept11: undefined,
      hasPayslip: true,
    })
    expect(rMissing.calculationStatus).toBe("missing-concept11")
  })

  it("12. coberturas ambiguas o mixtas (002 y 008 coexistentes) devuelven insufficient-data", () => {
    const r = calculateSalaryIncrease({
      tabular: 4000,
      substituteSalary: 2000,
      salaryType: "mixed",
      hasAmbiguousCoverages: true,
      concept11: 3000,
      hasPayslip: true,
    })
    expect(r.calculationStatus).toBe("insufficient-data")
    expect(r.estimatedFortnightlyIncrease).toBe(0)
  })

  it("13. tarjetón posterior al 16 de octubre retorna estado new-schedule-unverified y no $0.00 como si fuera cálculo definitivo", () => {
    const r = calculateSalaryIncrease({
      tabular: 10000,
      concept11: 8605,
      hasPayslip: true,
      isPostCutoff: true,
    })
    expect(r.calculationStatus).toBe("new-schedule-unverified")
    expect(r.isPostCutoff).toBe(true)
    expect(r.estimatedFortnightlyIncrease).toBe(0)
  })
})
