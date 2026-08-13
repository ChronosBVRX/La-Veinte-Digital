import { describe, it, expect } from "vitest"
import { searchGuide } from "../lib/search"

describe("searchGuide", () => {
  it("devuelve el concepto por código exacto", () => {
    const results = searchGuide("033", 8)
    expect(results.some((r) => r.code === "033") && results.every((r) => r.score > 0)).toBe(true)
  })

  it("normaliza códigos de 2 dígitos", () => {
    const results = searchGuide("2", 8)
    expect(results.some((r) => r.code === "002")).toBe(true)
  })

  it("encuentra conceptos por texto sin acentos", () => {
    const results = searchGuide("puntualidad", 8)
    expect(results.some((r) => r.code === "033")).toBe(true)
  })

  it("encuentra por términos parciales", () => {
    const results = searchGuide("aguinal", 8)
    expect(results.some((r) => ["043", "047", "049"].includes(r.code) || r.name.toLowerCase().includes("aguinaldo"))).toBe(true)
  })

  it("devuelve lista vacía para consulta sin resultados", () => {
    expect(searchGuide("zzzzzz", 8)).toEqual([])
  })

  it("respeta el límite", () => {
    const results = searchGuide("sueldo", 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})
