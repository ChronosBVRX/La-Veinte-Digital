import { describe, it, expect } from "vitest"
import { calculateAguinaldo } from "../lib/aguinaldo"
import { calculateSegundaJulio, calculateSegundaJulioProporcional, validateDiasLaborados } from "../lib/segundaJulio"
import { calculateClausula97 } from "../lib/clausula97"
import { calculateTiempoExtra, calculateTiempoExtraLegacy, sumTiempoExtraConceptos, validateHorasExtra } from "../lib/tiempoExtra"
import { roundCurrency, formatCurrency, parseCurrencyInput } from "../lib/money"
import { calcularPrestamos, normalizeSearch, filterCategorias, mapJsonToPrestamoRecord } from "../lib/prestamos"
import type { PrestamoCategoriaRecord, TiempoExtraInput } from "../lib/types"
import prestamosRaw from "../data/prestamos_categoria.json"

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
  it("parseCurrencyInput normaliza comas, simbolo y espacios", () => {
    expect(parseCurrencyInput("$12,345.67")).toBe(12345.67)
    expect(parseCurrencyInput("12,345.67")).toBe(12345.67)
    expect(parseCurrencyInput("$ 1 000.50")).toBe(1000.5)
    expect(parseCurrencyInput("1000")).toBe(1000)
    expect(parseCurrencyInput("")).toBeNull()
    expect(parseCurrencyInput("abc")).toBeNull()
    expect(parseCurrencyInput("-100")).toBeNull()
    expect(parseCurrencyInput("Infinity")).toBeNull()
  })
})

describe("Aguinaldo", () => {
  const r = calculateAguinaldo({ concepto002: 10000, concepto011: 2000 })
  it("calcula base correctamente", () => { expect(r.base).toBe(12000) })
  it("calcula total correctamente", () => { expect(r.total).toBeCloseTo(89891.47880531429, 2) })
  it("calcula anticipo de enero (047)", () => { expect(r.anticipoEnero047).toBeCloseTo(14981.913134219048, 5) })
  it("calcula anticipo de agosto (043)", () => { expect(r.anticipoAgosto043).toBeCloseTo(29963.826268438096, 5) })
  it("calcula resto de diciembre (049)", () => { expect(r.restoDiciembre049).toBeCloseTo(44945.73940265715, 5) })
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
  it("validacion: 0 dias falla", () => { expect(validateDiasLaborados(0)).not.toBeNull() })
  it("validacion: 361 dias falla", () => { expect(validateDiasLaborados(361)).not.toBeNull() })
  it("validacion: decimales fallan", () => { expect(validateDiasLaborados(1.5)).not.toBeNull() })
  it("validacion: 1 y 360 dias pasan", () => {
    expect(validateDiasLaborados(1)).toBeNull()
    expect(validateDiasLaborados(360)).toBeNull()
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
    expect(r.factor).toBe(2)
    expect(r.horasExtra).toBe(5)
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
  it("cero horas es invalido", () => {
    expect(validateHorasExtra(0)).not.toBeNull()
    expect(validateHorasExtra(-1)).not.toBeNull()
  })
  it("maximo razonable de horas", () => {
    expect(validateHorasExtra(24)).toBeNull()
    expect(validateHorasExtra(25)).not.toBeNull()
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
    sueldoQuincenal: 5000, concepto011: 2000, smtabMas011: 9000, smi: 3000,
  }
  it("calcularPrestamos usa SMTAB+011 como base", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find(x => x.modalidad === name)!
    expect(byName("Cláusula 97 - 1 mes").valor).toBe(9000)
    expect(byName("Cláusula 97 - 2 meses").valor).toBe(18000)
    expect(byName("Cláusula 97 - 3 meses").valor).toBe(27000)
    expect(byName("Concepto 160").valor).toBe(900)
  })
  it("calcularPrestamos genera todas las modalidades", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find(x => x.modalidad === name)!.valor
    expect(byName("Automóvil")).toBe(72000)
    expect(byName("Hipotecario")).toBe(225000)
    expect(byName("Enganche")).toBe(45000)
    expect(byName("Mediano plazo")).toBe(105000)
  })
  it("calcularPrestamos cae a sueldo quincenal + 011 si falta SMTAB+011", () => {
    const withoutSmtab: PrestamoCategoriaRecord = { categoria: "X", sueldoQuincenal: 5000, concepto011: 2000, smi: 3000 }
    const r = calcularPrestamos(withoutSmtab)
    expect(r.find(x => x.modalidad === "Cláusula 97 - 1 mes")!.valor).toBe(7000)
  })
  it("relaciones SMI", () => {
    const r = calcularPrestamos(record)
    const byName = (name: string) => r.find(x => x.modalidad === name)!.valor
    expect(byName("Automóvil")).toBe(3000 * 24)
    expect(byName("Enganche")).toBe(3000 * 15)
    expect(byName("Mediano plazo")).toBe(3000 * 35)
    expect(byName("Hipotecario")).toBe(3000 * 75)
  })
  it("normalizeSearch elimina acentos", () => {
    expect(normalizeSearch("Canonigo")).toBe("canonigo")
    expect(normalizeSearch("CEDULA")).toBe("cedula")
    expect(normalizeSearch("  Canónigo  ")).toBe("canonigo")
  })
  it("filterCategorias filtra", () => {
    const records = [
      { categoria: "08", descripcionTC: "Auxiliar" },
      { categoria: "02", descripcionTC: "Enfermera" },
    ] as PrestamoCategoriaRecord[]
    expect(filterCategorias(records, "auxiliar")).toHaveLength(1)
    expect(filterCategorias(records, "08")).toHaveLength(1)
    expect(filterCategorias(records, "")).toHaveLength(2)
    expect(filterCategorias(records, "zzz")).toHaveLength(0)
  })
})

describe("Mapper del JSON real de préstamos", () => {
  it("mapea las claves originales del tabulador", () => {
    const raw = {
      "CATEGORIA": "08",
      "DESC TC": "BASE",
      "SDO PLAZA": 12345.67,
      "sdo qnal": 6172.84,
      "cpto 11": 5000,
      "SMTAB+11": 11172.84,
      "SMI": 10000,
      "C97 1 MES": 11172.84,
      "C97 2 M": 22345.68,
      "C97 3 M": 33518.52,
      "CPTO 160": 1117.28,
      "AUTO": 240000,
      "ENGANCHE": 150000,
      "MEDIANO": 350000,
      "HIPOTECARIO": 750000,
    }
    const r = mapJsonToPrestamoRecord(raw)
    expect(r.categoria).toBe("08")
    expect(r.descripcionTC).toBe("BASE")
    expect(r.sueldoPlaza).toBe(12345.67)
    expect(r.sueldoQuincenal).toBe(6172.84)
    expect(r.concepto011).toBe(5000)
    expect(r.smtabMas011).toBe(11172.84)
    expect(r.smi).toBe(10000)
    expect(r.clausula97UnMes).toBe(11172.84)
    expect(r.clausula97DosMeses).toBe(22345.68)
    expect(r.clausula97TresMeses).toBe(33518.52)
    expect(r.concepto160).toBe(1117.28)
    expect(r.automovil).toBe(240000)
    expect(r.enganche).toBe(150000)
    expect(r.medianoPlazo).toBe(350000)
    expect(r.hipotecario).toBe(750000)
  })

  it("el tabulador real tiene 117 registros y claves consistentes", () => {
    expect(Array.isArray(prestamosRaw)).toBe(true)
    const records = (prestamosRaw as Record<string, unknown>[]).map(mapJsonToPrestamoRecord)
    expect(records).toHaveLength(117)
    for (const r of records) {
      expect(r.categoria).not.toBe("")
      expect(r.smtabMas011).toBeDefined()
      expect(r.clausula97UnMes).toBeDefined()
      expect(r.smtabMas011).toBe(r.clausula97UnMes)
    }
  })

  it("los valores precalculados del JSON son consistentes con las relaciones", () => {
    const records = (prestamosRaw as Record<string, unknown>[]).map(mapJsonToPrestamoRecord)
    for (const r of records) {
      const base = r.smtabMas011 ?? 0
      const smi = r.smi ?? 0
      expect(Math.abs(roundCurrency(base * 0.1) - (r.concepto160 ?? 0))).toBeLessThanOrEqual(0.1)
      expect(Math.abs(roundCurrency(smi * 24) - (r.automovil ?? 0))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(roundCurrency(smi * 15) - (r.enganche ?? 0))).toBeLessThanOrEqual(0.5)
    }
  })
})
