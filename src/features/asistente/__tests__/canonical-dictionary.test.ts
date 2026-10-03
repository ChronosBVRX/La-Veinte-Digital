import { describe, it, expect } from "vitest"
import { normalizeForRetrieval } from "../lib/canonical-dictionary"

describe("canonical-dictionary", () => {
  it("expande términos coloquiales como 'radiólogo' a términos institucionales del CCT", () => {
    const { expandedQuery, subQueries } = normalizeForRetrieval("¿Cuánto gana en el profesiograma un radiólogo?")
    expect(expandedQuery).toContain("TECNICO RADIOLOGO")
    expect(expandedQuery).toContain("clausula 86 bis")
    expect(expandedQuery).toContain("emanaciones radiactivas")
    expect(expandedQuery).toContain("sueldo tabular diario")

    // Verifica descomposición Multi-Query
    const focuses = subQueries.map((s) => s.focus)
    expect(focuses).toContain("SALARY")
    expect(focuses).toContain("HAZARD_PAY")
    expect(focuses).toContain("JOB_DESCRIPTION")
  })

  it("inyecta la categoría y jornada del perfil cuando el usuario pregunta en primera persona", () => {
    const userProfile = {
      hasProfile: true,
      categoria: "TÉCNICO RADIÓLOGO",
      jornadaHoras: 8,
      exposicionRadiologica: true,
    }

    const { expandedQuery } = normalizeForRetrieval("¿Cuánto me toca de aguinaldo y cuál es mi sueldo?", userProfile)
    expect(expandedQuery).toContain("TÉCNICO RADIÓLOGO")
    expect(expandedQuery).toContain("jornada 8")
    expect(expandedQuery).toContain("clausula 86 bis")
  })

  it("mantiene la consulta intacta cuando no hay palabras clave especiales", () => {
    const { expandedQuery, subQueries } = normalizeForRetrieval("¿Quién es el secretario general del sindicato?")
    expect(expandedQuery).toBe("¿Quién es el secretario general del sindicato?")
    expect(subQueries.length).toBe(1)
    expect(subQueries[0].focus).toBe("GENERAL")
  })
})
