import { describe, it, expect } from "vitest"
import { conceptDetails } from "../data/concept-details"
import {
  getGuideConceptWithDetails,
  pendingIdentificationPercentage,
  detailLevelFor,
} from "../lib/catalog"
import { searchGuide } from "../lib/search"
import { guideConcepts } from "@/data/guia-tarjeton/concepts"
import { getSourceById } from "@/data/guia-tarjeton/sources"

describe("ficha del concepto 104 (CRÉDITO HIPOTECARIO FOVI)", () => {
  const d = conceptDetails["104"]

  it("tiene ficha completa (capa Fácil)", () => {
    expect(d).toBeTruthy()
    expect(d?.simple?.length ?? 0).toBeGreaterThan(60)
  })

  it("está clasificado como concepto histórico identificado", () => {
    expect(d?.level).toBe("historically_identified")
    expect(detailLevelFor("104")).toBe("historically_identified")
  })

  it("NO inventa una fórmula ni un simulador", () => {
    expect(d?.calculator).toBeUndefined()
    expect(d?.formulaVerificationStatus).not.toBe("verified")
  })

  it("cita fuentes de referencia de contexto (FOVI/SHF y CCT)", () => {
    expect(d?.contextSource).toContain("fovi-shf")
    expect(getSourceById("fovi-shf")?.officialUrl).toContain("cnbv.gob.mx")
    expect(d?.sources?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

describe("familia hipotecaria E.S.M.I.", () => {
  for (const code of ["106", "130", "133", "136"]) {
    it(`concepto ${code} tiene ficha con fuente directa`, () => {
      const d = conceptDetails[code]
      expect(d).toBeTruthy()
      expect(d?.level).toBe("officially_verified")
      expect(d?.directSource).toBe("cct-2025-2027")
      expect(d?.simple?.length ?? 0).toBeGreaterThan(60)
    })
  }
})

describe("deducciones clave verificadas", () => {
  const cases: Array<{ code: string; minSources: number }> = [
    { code: "151", minSources: 1 },
    { code: "154", minSources: 2 },
    { code: "155", minSources: 2 },
    { code: "160", minSources: 1 },
    { code: "166", minSources: 1 },
    { code: "170", minSources: 2 },
    { code: "180", minSources: 1 },
    { code: "189", minSources: 1 },
  ]
  for (const { code, minSources } of cases) {
    it(`concepto ${code} tiene ficha y fuentes`, () => {
      const d = conceptDetails[code]
      expect(d).toBeTruthy()
      expect(d?.sources?.length ?? 0).toBeGreaterThanOrEqual(minSources)
      expect(d?.level).toBeDefined()
    })
  }
})

describe("ficha conocida sin explicación (fallback C)", () => {
  it("un concepto identificado sin ficha no cuenta como explicado", () => {
    // "024" (COMPENSACIÓN) está en el catálogo pero no tiene ficha curada.
    const entry = getGuideConceptWithDetails("024")
    expect(entry).toBeTruthy()
    expect(entry?.details).toBeNull()
    expect(detailLevelFor("024")).toBe("pending_identification")
  })

  it("pendiente de identificación se mantiene bajo umbral", () => {
    const pct = pendingIdentificationPercentage()
    expect(pct).toBeLessThan(55)
  })
})

describe("aliases de búsqueda", () => {
  it('"fovi" encuentra el concepto 104', () => {
    const results = searchGuide("fovi")
    expect(results[0]?.code).toBe("104")
  })

  it('"infonavit" encuentra 154 y 189', () => {
    const results = searchGuide("infonavit")
    const codes = results.map((r) => r.code)
    expect(codes).toContain("154")
    expect(codes).toContain("189")
  })

  it('"enganche" encuentra 106', () => {
    const results = searchGuide("enganche")
    expect(results[0]?.code).toBe("106")
  })

  it('"jubilación" encuentra 107, 108 y 152', () => {
    const results = searchGuide("jubilación")
    const codes = results.map((r) => r.code)
    expect(codes).toContain("107")
    expect(codes).toContain("108")
    expect(codes).toContain("152")
  })
})

describe("registro de fuentes", () => {
  it("todas las fuentes referenciadas en fichas existen en guideSources", () => {
    const known = new Set(guideConcepts.map((c) => c.code))
    for (const [code, d] of Object.entries(conceptDetails)) {
      expect(known.has(code)).toBe(true)
      for (const sid of d.sources ?? []) {
        expect(getSourceById(sid)).not.toBeNull()
      }
    }
  })
})
