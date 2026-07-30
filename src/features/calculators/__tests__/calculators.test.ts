import { describe, it, expect } from "vitest"
import { calculateAguinaldo } from "../lib/aguinaldo"
import { calculateSegundaJulio, calculateSegundaJulioProporcional } from "../lib/segundaJulio"
import { calculateClausula97 } from "../lib/clausula97"
import { calculateTiempoExtra, calculateTiempoExtraLegacy, sumTiempoExtraConceptos } from "../lib/tiempoExtra"
import { roundCurrency, formatCurrency, parseCurrencyInput } from "../lib/money"
import { calcularPrestamos, normalizeSearch, filterCategorias } from "../lib/prestamos"
import type { PrestamoCategoriaRecord, TiempoExtraInput } from "../lib/types"

describe("money utils", () => {
  it("roundCurrency", () => {
    expect(roundCurrency(10.456)).toBe(10.46)
    expect(roundCurrency(10.454)).toBe(10.45)
  })
  it("formatCurrency produce formato mexicano", () => {
    const r = formatCurrency(12345.67)
    expect(r).toContain("12")
    expect(r).toContain("345")
    expect(r).toContain("67")
  })
  it("parseCurrencyInput normaliza comas y simbolo", () => {
    expect(parseCurrencyInput("$12,345.67")).toBe(12345.67)
    expect(parseCurrencyInput("12,345.67")).toBe(12345.67)
    expect(parseCurrencyInput("1000")).toBe(1000)
    expect(parseCurrencyInput("")).toBeNull()
    expect(parseCurrencyInput("abc")).toBeNull()
    expect(parseCurrencyInput("-100")).toBeNull()
  })
})

describe("Aguinaldo", () => {
  const r = calculateAguinaldo({ concepto002: 10000, concepto011: 2000 })
  it("calcula base correctamente", () => { expect(r.base).toBe(12000) })
  it("calcula total correctamente", () => { expect(r.total).toBeCloseTo(89891.47880531429, 2) })
  it("las tres partes suman el total", () => {
    const s = r.anticipoEnero047 + r.anticipoAgosto043 + r.restoDiciembre049
    expect(s).toBeCloseTo(r.total, 5)
  })
})

describe("Segunda de julio", () => {
  it("calcula correctamente con 10000 y 2000", () => {
    expect(calculateSegundaJulio({ concepto002: 10000, concepto011: 2000 })).toBe(36800)
  })
  it("calcula correctamente con ceros", () => {
    expect(calculateSegundaJulio({ concepto002: 0, concepto011: 0 })).toBe(0)
  })
})

describe("Segunda de julio proporcional", () => {
  it("calcula 180 dias correctamente", () => {
    const r = calculateSegundaJulioProporcional({ concepto002: 10000, concepto011: 2000, diasLaborados: 180 })
    expect(r.base).toBe(12000)
    expect(r.importeCompleto).toBe(36800)
    expect(r.proporcion).toBe(0.5)
    expect(r.resultado).toBe(18400)
  })
  it("1 dia", () => {
    const r = calculateSegundaJulioProporcional({ concepto002: 10000, concepto011: 2000, diasLaborados: 1 })
    expect(r.resultado).toBeGreaterThan(0)
    expect(r.resultado).toBeLessThan(36800)
  })
  it("360 dias igual al completo", () => {
    const r = calculateSegundaJulioProporcional({ concepto002: 10000, concepto011: 2000, diasLaborados: 360 })
    expect(r.resultado).toBe(r.importeCompleto)
  })
})

describe("Clausula 97", () => {
  const r = calculateClausula97({ concepto002: 10000, concepto011: 2000 })
  it("base quincenal", () => { expect(r.baseQuincenal).toBe(12000) })
  it("un mes", () => { expect(r.unMes).toBe(24000) })
  it("dos meses", () => { expect(r.dosMeses).toBe(48000) })
  it("tres meses", () => { expect(r.tresMeses).toBe(72000) })
  it("cuatro meses", () => { expect(r.cuatroMeses).toBe(96000) })
})

describe("Tiempo extra", () => {
  const input: TiempoExtraInput = {
    concepto002: 10000, concepto011: 2000, concepto020: 1000,
    conceptoAdicional1: 500, conceptoAdicional2: 300, concepto050: 200,
    jornada: 8, horasExtra: 5,
  }
  it("suma conceptos", () => { expect(sumTiempoExtraConceptos(input)).toBe(14000) })
  it("calcula formula corregida", () => {
    const r = calculateTiempoExtra(input)
    expect(r.sumaConceptos).toBe(14000)
    expect(r.horasOrdinariasPeriodo).toBe(120)
    expect(r.valorHora).toBeCloseTo(116.66666666666667, 5)
    expect(r.pago).toBeCloseTo(1166.6666666666667, 5)
  })
  it("duplicar horas duplica pago", () => {
    expect(calculateTiempoExtra({ ...input, horasExtra: 10 }).pago)
      .toBeCloseTo(calculateTiempoExtra({ ...input, horasExtra: 5 }).pago * 2, 5)
  })
  it("jornada 12 modifica valor hora", () => {
    expect(calculateTiempoExtra({ ...input, jornada: 12 }).valorHora)
      .toBeLessThan(calculateTiempoExtra({ ...input, jornada: 8 }).valorHora)
  })
  it("ningun NaN", () => {
    const r = calculateTiempoExtra(input)
    expect(Object.values(r).every(v => !isNaN(v as number))).toBe(true)
  })
  it("legacy difiere de corregida", () => {
    const legacy = calculateTiempoExtraLegacy(input)
    expect(legacy).not.toBe(calculateTiempoExtra(input).pago)
    expect(legacy).toBe((14000 * 2) / 120)
  })
})

describe("Prestamos", () => {
  const record: PrestamoCategoriaRecord = {
    categoria: "A1", descripcionTC: "Test",
    sueldoQuincenal: 5000, concepto011: 2000, smi: 3000,
  }
  it("calcularPrestamos genera todas las modalidades", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find(x => x.modalidad === name)!.valor
    expect(byName("Automóvil")).toBe(72000)
    expect(byName("Hipotecario")).toBe(225000)
    expect(byName("Enganche")).toBe(45000)
    expect(byName("Mediano plazo")).toBe(105000)
    expect(byName("Concepto 160")).toBe(700)
    expect(byName("Cláusula 97 - 1 mes")).toBe(7000)
    expect(byName("Cláusula 97 - 2 meses")).toBe(14000)
    expect(byName("Cláusula 97 - 3 meses")).toBe(21000)
  })
  it("normalizeSearch elimina acentos", () => {
    expect(normalizeSearch("Canonigo")).toBe("canonigo")
    expect(normalizeSearch("CEDULA")).toBe("cedula")
  })
  it("filterCategorias filtra", () => {
    const records = [
      { categoria: "08", descripcionTC: "Auxiliar" },
      { categoria: "02", descripcionTC: "Enfermera" },
    ] as PrestamoCategoriaRecord[]
    expect(filterCategorias(records, "auxiliar")).toHaveLength(1)
    expect(filterCategorias(records, "08")).toHaveLength(1)
    expect(filterCategorias(records, "")).toHaveLength(2)
  })
})

