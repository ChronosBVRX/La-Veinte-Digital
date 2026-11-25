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

  it("genera lexicalQuery limpio para FTS y expande categorías como 'manejador de alimentos'", () => {
    const { expandedQuery, lexicalQuery, subQueries } = normalizeForRetrieval(
      "¿Cuál es el sueldo de un manejador de alimentos?",
    )
    expect(expandedQuery).toContain("MANEJADOR DE ALIMENTOS")
    expect(expandedQuery).toContain("tabulador de sueldos")
    expect(lexicalQuery.toLowerCase()).toContain("manejador")
    expect(lexicalQuery.toLowerCase()).toContain("alimentos")
    expect(lexicalQuery).not.toMatch(/\bcual\b/i)
    expect(subQueries.map((s) => s.focus)).toContain("SALARY")
  })

  it("expande consultas generales y coloquiales de derechos, actas, RJP y accidentes con términos FTS en OR", () => {
    const general = normalizeForRetrieval("Oye soy nuevo y quiero saber qué prestaciones tengo en el IMSS")
    expect(general.expandedQuery).toContain("vacaciones")
    expect(general.expandedQuery).toContain("aguinaldo")
    expect(general.lexicalQuery).toContain(" OR ")

    const acta = normalizeForRetrieval("Mi jefe me quiere levantar un acta administrativa y me amenazó")
    expect(acta.expandedQuery).toContain("clausula 22")
    expect(acta.lexicalQuery).toContain("clausula 22")

    const rjp = normalizeForRetrieval("¿Cuándo me puedo jubilar con el RJP?")
    expect(rjp.expandedQuery).toContain("regimen de jubilaciones y pensiones")

    const trayecto = normalizeForRetrieval("Tuve un accidente camino al trabajo")
    expect(trayecto.expandedQuery).toContain("3A21-003-010")
  })

  it("inyecta contexto de plaza 08 y categoría en preguntas generales sensibles al perfil", () => {
    const profile08 = {
      hasProfile: true,
      categoria: "ENFERMERA GENERAL",
      jornadaHoras: 6.5,
      tipoPlaza: "08 Sustituto",
    }
    const res = normalizeForRetrieval("¿Cuántos días de vacaciones tocan?", profile08)
    expect(res.expandedQuery).toContain("ENFERMERA GENERAL")
    expect(res.expandedQuery).toContain("jornada 6.5")
    expect(res.expandedQuery).toContain("sustituto 08 proporcional")
  })
})


