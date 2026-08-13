import { describe, it, expect } from "vitest"
import { compareQuincenas, describeChange, type PayChange } from "../lib/compare"
import type { GuidePayslip } from "../lib/types"

function payslip(over: Partial<GuidePayslip> = {}): GuidePayslip {
  return {
    id: "1",
    source: "local",
    earnings: [],
    deductions: [],
    observations: [],
    ...over,
  }
}

describe("compareQuincenas", () => {
  it("detecta conceptos nuevos", () => {
    const current = payslip({ earnings: [{ code: "033", description: "Puntualidad", amount: 100, kind: "earning" }] })
    const previous = payslip({ earnings: [] })
    const result = compareQuincenas(current, previous)
    expect(result.changes.some((c) => c.type === "nuevo" && c.code === "033")).toBe(true)
  })

  it("detecta conceptos que desaparecen", () => {
    const current = payslip({ deductions: [] })
    const previous = payslip({ deductions: [{ code: "172", description: "Falta", amount: 50, kind: "deduction" }] })
    const result = compareQuincenas(current, previous)
    expect(result.changes.some((c) => c.type === "desaparecio" && c.code === "172")).toBe(true)
  })

  it("detecta variación de importe (subió/bajó)", () => {
    const current = payslip({ earnings: [{ code: "011", description: "Renta", amount: 1200, kind: "earning" }] })
    const previous = payslip({ earnings: [{ code: "011", description: "Renta", amount: 1000, kind: "earning" }] })
    const result = compareQuincenas(current, previous)
    expect(result.changes.some((c) => c.type === "subio" && c.code === "011")).toBe(true)
  })

  it("ignora diferencias de centavos (redondeo)", () => {
    const current = payslip({ earnings: [{ code: "002", description: "Sueldo", amount: 1234.0, kind: "earning" }] })
    const previous = payslip({ earnings: [{ code: "002", description: "Sueldo", amount: 1234.009, kind: "earning" }] })
    const result = compareQuincenas(current, previous)
    expect(result.changes).toEqual([])
  })

  it("normaliza códigos de distinto ancho (33 vs 033)", () => {
    const current = payslip({ earnings: [{ code: "033", description: "Puntualidad", amount: 100, kind: "earning" }] })
    const previous = payslip({ earnings: [{ code: "33", description: "Puntualidad", amount: 100, kind: "earning" }] })
    const result = compareQuincenas(current, previous)
    expect(result.changes).toEqual([])
  })
})

describe("describeChange", () => {
  const cases: Array<[PayChange, string]> = [
    [{ type: "nuevo", code: "030", label: "Prima dominical" }, "aparece"],
    [{ type: "desaparecio", code: "030", label: "Prima dominical" }, "no aparece"],
    [{ type: "subio", code: "011", label: "Renta" }, "aumentó"],
    [{ type: "bajo", code: "011", label: "Renta" }, "menor"],
  ]
  for (const [change, fragment] of cases) {
    it(`describe ${change.type} de forma descriptiva`, () => {
      expect(describeChange(change)).toContain(fragment)
    })
  }
})
