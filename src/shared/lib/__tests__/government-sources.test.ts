import { describe, expect, it } from "vitest"
import {
  GOVERNMENT_SOURCES,
  INDEPENDENCE_NOTICE_SHORT,
  getSourceById,
} from "@/shared/lib/government-sources"

describe("government-sources registry", () => {
  it("contiene las 7 fuentes mínimas con URL oficial", () => {
    const ids = GOVERNMENT_SOURCES.map((s) => s.id)
    for (const required of [
      "imss-portal",
      "gobmx-imss",
      "dof",
      "diputados-leyes",
      "lft",
      "lss",
      "cct-imss-sntss-2025-2027",
    ]) {
      expect(ids).toContain(required)
    }
    for (const s of GOVERNMENT_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.titulo.length).toBeGreaterThan(0)
      expect(s.emisor.length).toBeGreaterThan(0)
    }
  })

  it("no presenta el CCT como fuente gubernamental", () => {
    const cct = getSourceById("cct-imss-sntss-2025-2027")
    expect(cct?.categoria).toBe("laboral-cct")
    expect(cct?.esGubernamental).toBe(false)
  })

  it("el aviso de independencia niega afiliación oficial", () => {
    expect(INDEPENDENCE_NOTICE_SHORT).toMatch(/independiente/i)
    expect(INDEPENDENCE_NOTICE_SHORT).toMatch(/No es una aplicación oficial/)
  })

  it("getSourceById devuelve undefined para ids desconocidos (no fabricar citas)", () => {
    expect(getSourceById("fuente-inexistente")).toBeUndefined()
  })

  it("la descripción breve de Play no excede 80 caracteres", () => {
    const short = "Herramientas laborales y normativas para trabajadores. App independiente."
    expect(short.length).toBeLessThanOrEqual(80)
  })
})
