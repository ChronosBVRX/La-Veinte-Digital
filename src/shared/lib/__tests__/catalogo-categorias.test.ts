import { describe, it, expect } from "vitest"
import { findCategoria, matchCategorySearch, CATALOGO_CATEGORIAS } from "../catalogo-categorias"

describe("catalogo-categorias", () => {
  it("encuentra categoría por nombre canónico exacto", () => {
    const c = findCategoria("AUX LIMPIEZA E HIGIENE UM Y NO MED 80")
    expect(c).toBeDefined()
    expect(c?.nombre).toBe("AUX LIMPIEZA E HIGIENE UM Y NO MED 80")
    expect(c?.sueldoQuincenal).toBeGreaterThan(0)
  })

  it("encuentra categoría Auxiliar de Limpieza e Higiene a través de sus alias", () => {
    const aliases = [
      "AUX LIMPIEZA E HIGIENE UM Y NO MED",
      "AUXILIAR DE LIMPIEZA E HIGIENE",
      "AUXILIAR DE LIMPIEZA E HIGIENE 80",
      "AUX DE LIMPIEZA E HIGIENE",
      "AUXILIAR DE HIGIENE Y LIMPIEZA",
      "LIMPIEZA E HIGIENE",
    ]
    for (const alias of aliases) {
      const c = findCategoria(alias)
      expect(c, `Fallo para alias: ${alias}`).toBeDefined()
      expect(c?.nombre).toBe("AUX LIMPIEZA E HIGIENE UM Y NO MED 80")
    }
  })

  it("encuentra categoría Ayudante de Limpieza e Higiene a través de sus alias", () => {
    const aliases = [
      "AYTE LIMPIEZA E HIGIENE UM Y NO MED",
      "AYUDANTE DE LIMPIEZA E HIGIENE",
      "AYTE DE LIMPIEZA E HIGIENE",
      "AYUDANTE DE HIGIENE Y LIMPIEZA",
    ]
    for (const alias of aliases) {
      const c = findCategoria(alias)
      expect(c, `Fallo para alias: ${alias}`).toBeDefined()
      expect(c?.nombre).toBe("AYTE LIMPIEZA E HIGIENE UM Y NO MED 80")
    }
  })

  it("encuentra Intendencia a través de sus alias", () => {
    const c1 = findCategoria("AUXILIAR DE SERVICIOS DE INTENDENCIA 80")
    expect(c1).toBeDefined()
    expect(c1?.nombre).toBe("AUX DE SERVS DE INT 80")

    const c2 = findCategoria("AYUDANTE DE SERVICIOS DE INTENDENCIA 80")
    expect(c2).toBeDefined()
    expect(c2?.nombre).toBe("AYTE DE SERVS DE INT 80")
  })

  it("incluye categorías médicas y de enfermería de alta demanda en el catálogo oficial", () => {
    const noFam = findCategoria("MEDICO NO FAMILIAR 80")
    expect(noFam).toBeDefined()
    expect(noFam?.sueldoQuincenal).toBe(6422.10)
    expect(noFam?.concepto011).toBe(5275.75)

    const enfEsp = findCategoria("ENFERMERA ESPECIALISTA 80")
    expect(enfEsp).toBeDefined()
    expect(enfEsp?.sueldoQuincenal).toBe(4207.74)
    expect(enfEsp?.concepto011).toBe(3456.66)

    const r1 = findCategoria("RESIDENTE 1")
    expect(r1).toBeDefined()
    expect(r1?.nombre).toBe("MEDICO RESIDENTE R1")
  })

  it("matchCategorySearch resuelve búsquedas intuitivas y sinónimos comunes", () => {
    // "enfermero" debe coincidir con ENFERMERA GENERAL 80
    expect(matchCategorySearch("ENFERMERA GENERAL 80", "enfermero")).toBe(true)

    // "auxiliar de enfermeria" debe coincidir con AUX DE ENFERMERIA GRAL 80
    expect(matchCategorySearch("AUX DE ENFERMERIA GRAL 80", "auxiliar de enfermeria")).toBe(true)

    // "intendencia" debe coincidir con AUX DE SERVS DE INT 80
    expect(matchCategorySearch("AUX DE SERVS DE INT 80", "intendencia")).toBe(true)

    // "medico especialista" debe coincidir con MEDICO NO FAMILIAR 80
    expect(matchCategorySearch("MEDICO NO FAMILIAR 80", "medico especialista")).toBe(true)

    // "rayos x" debe coincidir con TECNICO RADIOLOGO 80
    expect(matchCategorySearch("TECNICO RADIOLOGO 80", "rayos x")).toBe(true)

    // "chofer 80" debe coincidir con CHOFER 80
    expect(matchCategorySearch("CHOFER 80", "chofer 80")).toBe(true)
  })

  it("devuelve undefined para categorías que no existen", () => {
    expect(findCategoria("PUESTO TOTALMENTE INVENTADO 99")).toBeUndefined()
  })
})
