import { describe, it, expect } from "vitest"
import { findCategoria } from "../catalogo-categorias"

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

  it("devuelve undefined para categorías que no existen", () => {
    expect(findCategoria("PUESTO TOTALMENTE INVENTADO 99")).toBeUndefined()
  })
})
