import { describe, expect, it } from "vitest"
import { directRadioEpisode, polishDialogue, analyzeDiversity, DEFAULT_SPEAKERS, type EvidenceClaim } from "@la-veinte/radio-core"

const CLAIMS: EvidenceClaim[] = Array.from({ length: 6 }, (_, i) => ({
  id: `C${i + 1}`,
  texto: `Evidencia ${i + 1}: se considera tiempo extraordinario el que excede los límites de la jornada diaria establecidos en el contrato colectivo.`,
  documento: "CCT-IMSS-SNTSS-2025-2027",
  clausula: `Cláusula ${32 + i}`,
  articulo: null,
  pagina: 30 + i,
}));

describe("DialoguePolisher", () => {
  it("nunca modifica líneas factuales (con citas)", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 8, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS,
      cutoff: "2026-08-14", fuentes: [],
    })
    const factuales = script.turns.filter((t) => t.citations.length > 0).map((t) => ({ id: t.id, text: t.text }))
    const r = polishDialogue(script)
    expect(r.lineasFactualesIntactas).toBe(true)
    for (const f of factuales) {
      const nuevo = r.script.turns.find((t) => t.id === f.id)
      expect(nuevo?.text).toBe(f.text)
    }
  })

  it("mejora la diversidad de un guion monótono", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 15, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS,
      cutoff: "2026-08-14", fuentes: [],
    })
    const antes = analyzeDiversity(script).score
    const r = polishDialogue(script)
    const despues = r.informe.score
    expect(r.cambios).toBeGreaterThan(0)
    expect(despues).toBeGreaterThanOrEqual(antes)
  })

  it("es determinista con la misma semilla", () => {
    const make = () => directRadioEpisode({
      tema: "T", duracionMin: 8, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS.slice(0, 3),
      cutoff: "2026-08-14", fuentes: [],
    })
    const a = polishDialogue(make(), 42)
    const b = polishDialogue(make(), 42)
    expect(a.script.turns.map((t) => t.text)).toEqual(b.script.turns.map((t) => t.text))
  })
})
