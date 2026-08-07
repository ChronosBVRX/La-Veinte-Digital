import { describe, it, expect } from "vitest"
import { detectImssTemplate, IMSS_TARJETON_ANCHORS, TEMPLATE_NOT_DETECTED_MESSAGE } from "../lib/imss-template-detector"
import type { ReconstructedLine } from "../lib/line-reconstruction"

function line(norm: string): ReconstructedLine {
  return {
    index: 0,
    page: 1,
    y: 0,
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    text: norm,
    norm,
    items: [],
    confidence: 1,
    method: "native_text",
  }
}

function linesFromText(text: string): ReconstructedLine[] {
  return text.split("\n").map((t, i) => ({ ...line(t.trim()), index: i }))
}

const REQUIRED_ANCHORS = IMSS_TARJETON_ANCHORS.filter((a) => a.required).map((a) => a.label)

const STRONG_TEMPLATE_TEXT = [
  "INSTITUTO MEXICANO DEL SEGURO SOCIAL",
  "RECIBO DE PAGO DE NOMINA",
  "PERCEPCIONES",
  "DEDUCCIONES",
  "TOTAL PERCEPCIONES",
  "TOTAL DEDUCCIONES",
  "ANTIGUEDAD EFECTIVA",
  "NOMBRE CATEGORIA/PUESTO",
  "MATRICULA",
  "OBSERVACIONES",
  "LIQUIDO",
  "FECHA DE INGRESO",
  "PERIODO DE PAGO",
  "CERTIFICACION",
].join("\n")

describe("detectImssTemplate", () => {
  it("detecta plantilla cuando todas las anclas están presentes", () => {
    const result = detectImssTemplate(linesFromText(STRONG_TEMPLATE_TEXT))
    expect(result.detected).toBe(true)
    expect(result.score).toBe(1)
    expect(result.missingRequired).toHaveLength(0)
    expect(result.matchedAnchors).toHaveLength(IMSS_TARJETON_ANCHORS.length)
  })

  it("detecta plantilla con anclas parciales si cumple mínimo y obligatorias", () => {
    const partialText = [
      "RECIBO DE PAGO DE NOMINA",
      "PERCEPCIONES",
      "DEDUCCIONES",
      "TOTAL PERCEPCIONES",
      "TOTAL DEDUCCIONES",
      "MATRICULA",
    ].join("\n")
    const result = detectImssTemplate(linesFromText(partialText))
    expect(result.detected).toBe(true)
    expect(result.matchedAnchors.length).toBeGreaterThanOrEqual(5)
    expect(result.missingRequired).toHaveLength(0)
    expect(result.score).toBeGreaterThan(0)
  })

  it("rechaza cuando falta una ancla obligatoria", () => {
    for (const required of REQUIRED_ANCHORS) {
      const text = STRONG_TEMPLATE_TEXT.replace(required, "")
      const result = detectImssTemplate(linesFromText(text))
      expect(result.detected).toBe(false)
      expect(result.missingRequired).toContain(required)
    }
  })

  it("rechaza cuando no alcanza el mínimo de anclas aunque las obligatorias estén presentes", () => {
    const text = [
      "RECIBO DE PAGO DE NOMINA",
      "PERCEPCIONES",
      "DEDUCCIONES",
    ].join("\n")
    const result = detectImssTemplate(linesFromText(text))
    expect(result.detected).toBe(false)
    expect(result.matchedAnchors.length).toBe(3)
    expect(result.missingRequired).toHaveLength(0)
  })

  it("rechaza texto que no corresponde a un tarjetón", () => {
    const foreignDocument = [
      "ESTADO DE CUENTA BANCARIO",
      "SALDO INICIAL",
      "DEPÓSITOS",
      "RETIROS",
      "SALDO FINAL",
    ].join("\n")
    const result = detectImssTemplate(linesFromText(foreignDocument))
    expect(result.detected).toBe(false)
    expect(result.matchedAnchors.length).toBe(0)
    expect(result.missingRequired).toEqual(REQUIRED_ANCHORS)
  })

  it("incluye el mensaje de rechazo exportado para el parser", () => {
    expect(TEMPLATE_NOT_DETECTED_MESSAGE).toMatch(/tarjetón/)
  })
})
