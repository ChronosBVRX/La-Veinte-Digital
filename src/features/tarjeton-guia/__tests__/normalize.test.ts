import { describe, it, expect } from "vitest"
import { normalizeText, normalizeCode, looksLikeCode, cleanConceptName } from "../lib/normalize"

describe("normalizeText", () => {
  it("normaliza mayúsculas, espacios y acentos", () => {
    expect(normalizeText("  ESTIMULO POR PUNTUALIDAD  ")).toBe("estimulo por puntualidad")
    expect(normalizeText("Médico Residente")).toBe("medico residente")
  })

  it("colapsa espacios múltiples y separadores", () => {
    expect(normalizeText("ayuda\tde   renta\n")).toBe("ayuda de renta")
  })
})

describe("normalizeCode", () => {
  it("rellena con ceros a la izquierda (3 dígitos)", () => {
    expect(normalizeCode("33")).toBe("033")
    expect(normalizeCode("2")).toBe("002")
  })

  it("mantiene códigos de 3 dígitos", () => {
    expect(normalizeCode("033")).toBe("033")
  })

  it("ignora espacios alrededor", () => {
    expect(normalizeCode(" 151 ")).toBe("151")
  })

  it("devuelve null para entradas inválidas", () => {
    expect(normalizeCode("")).toBeNull()
    expect(normalizeCode("abc")).toBeNull()
    expect(normalizeCode("1234")).toBeNull()
  })

  it("extrae dígitos de cadenas mixtas (contrato leniente de búsqueda)", () => {
    expect(normalizeCode("1a")).toBe("001")
    expect(normalizeCode("002 sueldo")).toBe("002")
  })
})

describe("looksLikeCode", () => {
  it("detecta cadenas numéricas de 2–3 dígitos", () => {
    expect(looksLikeCode("33")).toBe(true)
    expect(looksLikeCode("033")).toBe(true)
  })

  it("rechaza texto libre", () => {
    expect(looksLikeCode("aguinaldo")).toBe(false)
    expect(looksLikeCode("12a")).toBe(false)
  })
})

describe("cleanConceptName", () => {
  it("recorta el prefijo de código de los nombres de la guía", () => {
    const out = cleanConceptName("033 ESTÍMULO POR PUNTUALIDAD")
    expect(typeof out).toBe("string")
    expect(out.trim().length).toBeGreaterThan(0)
    expect(out).not.toContain("033")
  })
})
