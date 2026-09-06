import { describe, it, expect } from "vitest"
import {
  getFortnightInfo,
  getLastDayOfMonth,
  calculateFaltaDescuento,
} from "../lib/falta-calculo"

describe("falta-calculo: Determinación de quincena natural", () => {
  it("determina la 1ª quincena (días 1 a 15)", () => {
    const q1Start = getFortnightInfo("2026-09-01")
    expect(q1Start.fortnightNumber).toBe(1)
    expect(q1Start.day).toBe(1)
    expect(q1Start.label).toContain("1ª quincena")
    expect(q1Start.label).toContain("1–15 de septiembre")

    const q1End = getFortnightInfo("2026-09-15")
    expect(q1End.fortnightNumber).toBe(1)
    expect(q1End.day).toBe(15)
  })

  it("determina la 2ª quincena (días 16 a fin de mes)", () => {
    const q2Start = getFortnightInfo("2026-09-16")
    expect(q2Start.fortnightNumber).toBe(2)
    expect(q2Start.day).toBe(16)
    expect(q2Start.label).toContain("2ª quincena")
    expect(q2Start.label).toContain("16–30 de septiembre")

    const q2End = getFortnightInfo("2026-09-30")
    expect(q2End.fortnightNumber).toBe(2)
    expect(q2End.day).toBe(30)
  })

  it("calcula correctamente el fin de mes para meses de 31 días", () => {
    const oct = getFortnightInfo("2026-10-20")
    expect(oct.fortnightNumber).toBe(2)
    expect(oct.lastDayOfMonth).toBe(31)
    expect(oct.label).toContain("16–31 de octubre")
  })

  it("calcula febrero en año regular (28 días)", () => {
    expect(getLastDayOfMonth(2025, 2)).toBe(28)
    const feb25 = getFortnightInfo("2025-02-18")
    expect(feb25.lastDayOfMonth).toBe(28)
    expect(feb25.label).toContain("16–28 de febrero")
  })

  it("calcula febrero en año bisiesto (29 días, ej. 2028)", () => {
    expect(getLastDayOfMonth(2028, 2)).toBe(29)
    const feb28 = getFortnightInfo("2028-02-29")
    expect(feb28.fortnightNumber).toBe(2)
    expect(feb28.lastDayOfMonth).toBe(29)
    expect(feb28.label).toContain("16–29 de febrero")
  })
})

describe("falta-calculo: Cálculo de descuento estimado", () => {
  it("calcula salario diario y descuento exacto con sueldo base válido", () => {
    // Ejemplo: Sueldo base quincenal concepto 002 = $6,000.00
    const result = calculateFaltaDescuento({ baseSalaryFortnightly: 6000 })
    expect(result.status).toBe("calculated")
    expect(result.baseSalaryUsed).toBe(6000)
    expect(result.dailySalary).toBe(400)
    expect(result.estimatedDeduction).toBe(400)
    expect(result.formula).toContain("6,000.00")
    expect(result.formula).toContain("400.00")
    expect(result.missingDataReason).toBeUndefined()
  })

  it("maneja decimales y redondeo a centavos correctamente", () => {
    // Ejemplo: Sueldo base quincenal $7,543.21 -> diario = 502.88
    const result = calculateFaltaDescuento({ baseSalaryFortnightly: 7543.21 })
    expect(result.status).toBe("calculated")
    expect(result.baseSalaryUsed).toBe(7543.21)
    expect(result.dailySalary).toBe(502.88)
    expect(result.estimatedDeduction).toBe(502.88)
  })

  it("marca estado 'pending' si falta sueldo base sin inventar cifras", () => {
    const resultNull = calculateFaltaDescuento({ baseSalaryFortnightly: null })
    expect(resultNull.status).toBe("pending")
    expect(resultNull.estimatedDeduction).toBeUndefined()
    expect(resultNull.missingDataReason).toContain("Falta registrar sueldo base")

    const resultZero = calculateFaltaDescuento({ baseSalaryFortnightly: 0 })
    expect(resultZero.status).toBe("pending")

    const resultUndefined = calculateFaltaDescuento({})
    expect(resultUndefined.status).toBe("pending")
  })
})
