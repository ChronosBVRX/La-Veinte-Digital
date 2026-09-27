import { describe, it, expect } from "vitest"
import {
  getClausula,
  getArticuloEstatutos,
  findNormativaByConceptCode,
  searchNormativaOffline,
  getAllClausulas,
  getAllArticulosEstatutos,
} from "../normativa-lookup"

describe("Normativa Lookup Service (Offline CCT & Estatutos)", () => {
  it("loads all clauses and articles without errors", () => {
    const clausulas = getAllClausulas()
    const articulos = getAllArticulosEstatutos()

    expect(clausulas.length).toBeGreaterThan(140)
    expect(articulos.length).toBeGreaterThan(100)
  })

  it("finds key CCT clauses by number", () => {
    const c1 = getClausula(1)
    expect(c1).toBeDefined()
    expect(c1?.numero).toBe("1")
    expect(c1?.texto).toContain("Definiciones")

    const c47 = getClausula(47)
    expect(c47).toBeDefined()
    expect(c47?.texto).toContain("vacaciones")

    const c107 = getClausula(107)
    expect(c107).toBeDefined()
    expect(c107?.texto).toContain("aguinaldo")

    const c144 = getClausula("144")
    expect(c144).toBeDefined()
    expect(c144?.texto).toContain("Fondo de Ahorro")

    const c63Bis = getClausula("63 Bis")
    expect(c63Bis).toBeDefined()
  })

  it("finds key Estatutos articles by number", () => {
    const a1 = getArticuloEstatutos(1)
    expect(a1).toBeDefined()
    expect(a1?.texto).toContain("Sindicato Nacional de Trabajadores del Seguro Social")

    const a3 = getArticuloEstatutos("3")
    expect(a3).toBeDefined()
  })

  it("maps concept codes from tarjetón to the proper CCT clause", () => {
    const aguinaldoClause = findNormativaByConceptCode("023")
    expect(aguinaldoClause?.numero).toBe("107")

    const ahorroClause = findNormativaByConceptCode("050")
    expect(ahorroClause?.numero).toBe("144")

    const rentaClause = findNormativaByConceptCode("063")
    expect(rentaClause?.numero).toBe("63 Bis")

    const antiguedadClause = findNormativaByConceptCode("058")
    expect(antiguedadClause?.numero).toBe("80")
  })

  it("performs offline text search across clauses and articles", () => {
    const results = searchNormativaOffline("fondo de ahorro")
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.numero === "144")).toBe(true)

    const cctOnly = searchNormativaOffline("vacaciones", "cct")
    expect(cctOnly.every((r) => r.tipo === "cct")).toBe(true)
    expect(cctOnly.some((r) => r.numero === "47")).toBe(true)
  })
})
