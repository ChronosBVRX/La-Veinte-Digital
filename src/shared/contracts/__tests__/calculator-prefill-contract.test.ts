import { describe, it, expect } from "vitest"
import {
  CALCULATOR_IDS,
  isCalculatorId,
  isIsoDateString,
  isCalculatorPrefillResponse,
  type CalculatorPrefillResponse,
  type PrefillField,
} from "../calculator-prefill"

describe("contrato: lista cerrada de calculadoras", () => {
  it("contiene las seis calculadoras soportadas", () => {
    expect(CALCULATOR_IDS).toEqual([
      "aguinaldo",
      "clausula-97",
      "prestamos",
      "segunda-julio",
      "segunda-julio-proporcional",
      "tiempo-extra",
    ])
  })

  it("isCalculatorId acepta solo ids validos", () => {
    expect(isCalculatorId("aguinaldo")).toBe(true)
    expect(isCalculatorId("tiempo-extra")).toBe(true)
    expect(isCalculatorId("segunda-julio-proporcional")).toBe(true)
    expect(isCalculatorId("aguinaldo ")).toBe(false)
    expect(isCalculatorId("aguinaldos")).toBe(false)
    expect(isCalculatorId("vacaciones")).toBe(false)
    expect(isCalculatorId(42)).toBe(false)
    expect(isCalculatorId(null)).toBe(false)
  })
})

describe("contrato: validacion de fecha ISO", () => {
  it("acepta fechas reales", () => {
    expect(isIsoDateString("2026-07-31")).toBe(true)
    expect(isIsoDateString("2024-02-29")).toBe(true)
    expect(isIsoDateString("1900-01-01")).toBe(true)
  })

  it("rechaza formatos invalidos", () => {
    expect(isIsoDateString("2026-7-31")).toBe(false)
    expect(isIsoDateString("31/07/2026")).toBe(false)
    expect(isIsoDateString("20260731")).toBe(false)
    expect(isIsoDateString("2026-07-31T00:00:00Z")).toBe(false)
    expect(isIsoDateString("")).toBe(false)
    expect(isIsoDateString(20260731)).toBe(false)
    expect(isIsoDateString(null)).toBe(false)
  })

  it("rechaza fechas inexistentes", () => {
    expect(isIsoDateString("2026-13-01")).toBe(false)
    expect(isIsoDateString("2026-00-10")).toBe(false)
    expect(isIsoDateString("2026-02-30")).toBe(false)
    expect(isIsoDateString("2025-02-29")).toBe(false)
    expect(isIsoDateString("2026-04-31")).toBe(false)
  })
})

function field(value: number): PrefillField<number> {
  return {
    value,
    source: "salary_table",
    confidence: "high",
    effectiveAt: "2026-07-31",
    editable: true,
    ruleVersion: "salary-table-2025-2027",
    legalReference: "Tabulador de sueldos vigente",
  }
}

function validResponse(): CalculatorPrefillResponse {
  return {
    schemaVersion: "1.0",
    calculatorId: "aguinaldo",
    targetDate: "2026-07-31",
    generatedAt: "2026-07-31T10:00:00.000Z",
    categoryResolved: true,
    categoryResolutionStatus: "resolved",
    fields: {
      categoryId: { value: "ABOGADO_80", source: "profile", confidence: "high", effectiveAt: "2026-07-31", editable: true },
      categoryName: { value: "ABOGADO 80", source: "profile", confidence: "high", effectiveAt: "2026-07-31", editable: true },
      concepto002: field(5446.48),
      concepto011: field(4201.96),
    },
    missingFacts: [],
    warnings: [],
  }
}

describe("contrato: validacion de respuesta", () => {
  it("acepta una respuesta completa y valida", () => {
    expect(isCalculatorPrefillResponse(validResponse())).toBe(true)
  })

  it("rechaza schemaVersion distinto", () => {
    const r = validResponse()
    expect(isCalculatorPrefillResponse({ ...r, schemaVersion: "0.9" })).toBe(false)
  })

  it("rechaza calculadora no soportada", () => {
    const r = validResponse()
    expect(isCalculatorPrefillResponse({ ...r, calculatorId: "hack" })).toBe(false)
  })

  it("rechaza targetDate invalida", () => {
    const r = validResponse()
    expect(isCalculatorPrefillResponse({ ...r, targetDate: "ayer" })).toBe(false)
  })

  it("rechaza status de categoria invalido", () => {
    const r = validResponse()
    expect(isCalculatorPrefillResponse({ ...r, categoryResolutionStatus: "misterioso" })).toBe(false)
  })

  it("rechaza campos con tipos incorrectos", () => {
    const r = validResponse()
    const bad = {
      ...r,
      fields: { ...r.fields, concepto002: { ...field(100), value: "no-es-numero" } },
    }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
  })

  it("rechaza campo sin metadatos de fuente", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, concepto020: { value: 250 } } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
  })

  it("rechaza importes de concepto negativos", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, concepto020: field(-1) } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
    const ok = { ...r, fields: { ...r.fields, concepto020: field(0) } }
    expect(isCalculatorPrefillResponse(ok)).toBe(true)
  })

  it("rechaza jornadas no validas en workdayHours", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, workdayHours: field(7) } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
    const ok = { ...r, fields: { ...r.fields, workdayHours: field(6.5) } }
    expect(isCalculatorPrefillResponse(ok)).toBe(true)
  })

  it("rechaza antiguedad fuera del rango 0-80", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, seniorityYears: field(81) } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
    const ok = { ...r, fields: { ...r.fields, seniorityYears: field(80) } }
    expect(isCalculatorPrefillResponse(ok)).toBe(true)
  })

  it("rechaza dias laborados fuera del rango 0-366", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, daysWorkedInAnnualPeriod: field(367) } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
    const ok = { ...r, fields: { ...r.fields, daysWorkedInAnnualPeriod: field(366) } }
    expect(isCalculatorPrefillResponse(ok)).toBe(true)
  })

  it("rechaza propiedades extra dentro de fields", () => {
    const r = validResponse()
    const bad = { ...r, fields: { ...r.fields, concepto999: field(100), payload: { hack: 1 } } }
    expect(isCalculatorPrefillResponse(bad)).toBe(false)
    const nested = { ...r, fields: { ...r.fields, concepto020: { ...field(100), x: 1 } } }
    expect(isCalculatorPrefillResponse(nested)).toBe(false)
  })

  it("acepta respuestas parciales con campos ausentes", () => {
    const r = validResponse()
    const partial = { ...r, fields: { categoryName: r.fields.categoryName }, warnings: ["sin tarjeton"] }
    expect(isCalculatorPrefillResponse(partial)).toBe(true)
  })

  it("acepta estado ambiguous sin categoria", () => {
    const r: CalculatorPrefillResponse = {
      schemaVersion: "1.0",
      calculatorId: "aguinaldo",
      targetDate: "2026-07-31",
      generatedAt: "2026-07-31T10:00:00.000Z",
      categoryResolved: false,
      categoryResolutionStatus: "ambiguous",
      fields: {},
      missingFacts: ["category"],
      warnings: ["Encontramos más de una categoría parecida"],
    }
    expect(isCalculatorPrefillResponse(r)).toBe(true)
  })
})
