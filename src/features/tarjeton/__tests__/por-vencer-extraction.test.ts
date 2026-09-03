import { describe, it, expect } from "vitest"
import {
  parsePorVencerDate,
  parseImssDate,
  isValidMexicanCivilDate,
  formatCivilIsoDate,
  formatMexicanDate,
} from "../lib/imss-date-parser"
import { extractPorVencerField, parseImssTarjeton } from "../lib/imss-tarjeton-parser"
import { imssPositionedTextFixture } from "./fixtures/imss-positioned-text"
import type { ReconstructedLine } from "../lib/line-reconstruction"

describe("parsePorVencerDate - Formatos de fecha mexicana y validación estricta", () => {
  it("valida años bisiestos y días máximos del mes mediante isValidMexicanCivilDate", () => {
    expect(isValidMexicanCivilDate(29, 2, 2028)).toBe(true)
    expect(isValidMexicanCivilDate(29, 2, 2027)).toBe(false)
    expect(isValidMexicanCivilDate(31, 4, 2026)).toBe(false)
    expect(isValidMexicanCivilDate(30, 4, 2026)).toBe(true)
    expect(formatCivilIsoDate(14, 10, 2026)).toBe("2026-10-14")
  })

  it("convierte 14102026 a 2026-10-14 (DDMMYYYY compacto)", () => {
    expect(parsePorVencerDate("14102026")).toBe("2026-10-14")
  })

  it("convierte 01012027 a 2027-01-01", () => {
    expect(parsePorVencerDate("01012027")).toBe("2027-01-01")
  })

  it("convierte 29022028 a 2028-02-29 (año bisiesto válido)", () => {
    expect(parsePorVencerDate("29022028")).toBe("2028-02-29")
  })

  it("rechaza 29022027 como fecha inválida (2027 no es bisiesto)", () => {
    expect(parsePorVencerDate("29022027")).toBeUndefined()
  })

  it("convierte 31122026 a 2026-12-31", () => {
    expect(parsePorVencerDate("31122026")).toBe("2026-12-31")
  })

  it("rechaza fechas imposibles como 32132026, 31022026 o 00002026", () => {
    expect(parsePorVencerDate("32132026")).toBeUndefined()
    expect(parsePorVencerDate("31022026")).toBeUndefined()
    expect(parsePorVencerDate("00002026")).toBeUndefined()
    expect(parsePorVencerDate("")).toBeUndefined()
    expect(parsePorVencerDate(null)).toBeUndefined()
  })

  it("convierte 14/10/2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14/10/2026")).toBe("2026-10-14")
  })

  it("convierte 14-10-2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14-10-2026")).toBe("2026-10-14")
  })

  it("convierte 14.10.2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14.10.2026")).toBe("2026-10-14")
  })

  it("convierte 14 10 2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14 10 2026")).toBe("2026-10-14")
  })

  it("convierte 14 / 10 / 2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14 / 10 / 2026")).toBe("2026-10-14")
  })

  it("convierte dígitos separados por OCR (1 4 1 0 2 0 2 6) a 2026-10-14", () => {
    expect(parsePorVencerDate("1 4 1 0 2 0 2 6")).toBe("2026-10-14")
  })

  it("conserva y valida fechas canónicas ISO 2026-10-14", () => {
    expect(parsePorVencerDate("2026-10-14")).toBe("2026-10-14")
    expect(parsePorVencerDate("2027-02-29")).toBeUndefined()
  })

  it("convierte mes nombrado 14-OCT-2026 a 2026-10-14", () => {
    expect(parsePorVencerDate("14-OCT-2026")).toBe("2026-10-14")
  })
})

describe("formatMexicanDate - Visualización civil para el usuario", () => {
  it("formatea 2026-10-14 como 14/10/2026", () => {
    expect(formatMexicanDate("2026-10-14")).toBe("14/10/2026")
  })

  it("formatea 2027-01-01 como 01/01/2027", () => {
    expect(formatMexicanDate("2027-01-01")).toBe("01/01/2027")
  })

  it("formatea 2028-02-29 como 29/02/2028", () => {
    expect(formatMexicanDate("2028-02-29")).toBe("29/02/2028")
  })
})

describe("extractPorVencerField - Extracción anclada a la etiqueta", () => {
  function makeLine(text: string, index = 0): ReconstructedLine {
    return {
      index,
      page: 1,
      y: 100 + index * 12,
      xMin: 0,
      xMax: 100,
      yMin: 100 + index * 12,
      yMax: 110 + index * 12,
      text,
      norm: text.toUpperCase(),
      items: [],
      confidence: 1,
      method: "native_text",
    }
  }

  it("extrae fecha compacta 14102026 en la misma línea tras POR VENCER", () => {
    const lines = [makeLine("POR VENCER: 14102026")]
    const res = extractPorVencerField(lines)
    expect(res.porVencer).toBe("2026-10-14")
    expect(res.porVencerRaw).toBe("14102026")
  })

  it("extrae fecha con etiqueta sin espacio PORVENCER", () => {
    const lines = [makeLine("PORVENCER 14102026")]
    const res = extractPorVencerField(lines)
    expect(res.porVencer).toBe("2026-10-14")
  })

  it("extrae fecha con etiqueta espaciada por OCR (P O R  V E N C E R)", () => {
    const lines = [makeLine("P O R  V E N C E R: 14102026")]
    const res = extractPorVencerField(lines)
    expect(res.porVencer).toBe("2026-10-14")
  })

  it("extrae fecha separada por salto de línea (etiqueta en una línea, fecha en la siguiente)", () => {
    const lines = [
      makeLine("POR VENCER:", 0),
      makeLine("14102026", 1),
    ]
    const res = extractPorVencerField(lines)
    expect(res.porVencer).toBe("2026-10-14")
    expect(res.porVencerRaw).toBe("14102026")
  })

  it("extrae fecha con OCR de dígitos separados tras salto de línea", () => {
    const lines = [
      makeLine("POR VENCER", 0),
      makeLine("1 4 1 0 2 0 2 6", 1),
    ]
    const res = extractPorVencerField(lines)
    expect(res.porVencer).toBe("2026-10-14")
  })

  it("extrae formatos con separadores / y -", () => {
    const l1 = [makeLine("POR VENCER 14/10/2026")]
    expect(extractPorVencerField(l1).porVencer).toBe("2026-10-14")

    const l2 = [makeLine("POR VENCER: 14-10-2026")]
    expect(extractPorVencerField(l2).porVencer).toBe("2026-10-14")

    const l3 = [makeLine("POR VENCER 14 10 2026")]
    expect(extractPorVencerField(l3).porVencer).toBe("2026-10-14")
  })

  it("NUNCA toma un número de 8 dígitos fuera del contexto POR VENCER", () => {
    // Matrícula de 8 dígitos
    const linesWithMatricula = [
      makeLine("MATRICULA: 99123456", 0),
      makeLine("NOMBRE: JUAN PEREZ LOPEZ", 1),
      makeLine("RFC: PELJ801014123", 2),
      makeLine("FOLIO: 87654321", 3),
    ]
    const res = extractPorVencerField(linesWithMatricula)
    expect(res.porVencer).toBeUndefined()
    expect(res.porVencerRaw).toBeUndefined()
  })

  it("parseImssDate genérico no interpreta números de 8 dígitos arbitrarios como fecha", () => {
    // Matrículas y folios no deben ser reconocidos como fechas por parseImssDate
    expect(parseImssDate("99123456")).toBeUndefined()
    expect(parseImssDate("14102026")).toBeUndefined()
  })
})

describe("parseImssTarjeton - Integración completa con positioned text", () => {
  it("extrae POR VENCER 14102026 y puebla porVencer, dueDate y porVencerRaw", async () => {
    const items = [
      ...imssPositionedTextFixture,
      { text: "POR VENCER:", page: 1, x: 440, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
      { text: "14102026", page: 1, x: 560, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
    ]
    const outcome = await parseImssTarjeton({ items, pageCount: 2 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.parsed.vacations.porVencer).toBe("2026-10-14")
    expect(outcome.parsed.vacations.dueDate).toBe("2026-10-14")
    expect(outcome.parsed.vacations.porVencerRaw).toBe("14102026")
  })
})
