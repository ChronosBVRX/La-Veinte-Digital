import { describe, expect, it } from "vitest"
import { directRadioEpisode, polishDialogue, analyzeDiversity, DEFAULT_SPEAKERS, type EvidenceClaim, type EpisodeScript, type DialogueTurn } from "@la-veinte/radio-core"

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
    // Guion sintético deliberadamente monótono (el director ya produce guiones variados)
    const monotono: EpisodeScript = {
      tema: "T", formato: "prueba", nivel: "natural", modoCita: "natural",
      speakers: DEFAULT_SPEAKERS,
      scenes: [{ id: "s1", titulo: "test", turns: [] }],
      turns: [], cutoff: "2026-08-14", fuentes: [], estimacionDurSec: 0,
    }
    for (let i = 0; i < 10; i++) {
      const t: DialogueTurn = {
        id: `t${i}`, speaker: i % 2 ? "ANDREA" : "EDUARDO",
        text: `Exacto, este es el punto número ${i + 1} del tema que estamos tratando hoy.`,
        pauseBeforeMs: 200, pauseAfterMs: 200, energy: 3, pace: "normal",
        canOverlap: false, transition: null, citations: [],
      }
      monotono.turns.push(t)
      monotono.scenes[0].turns.push(t)
    }
    const antes = analyzeDiversity(monotono).score
    const r = polishDialogue(monotono)
    expect(r.cambios).toBeGreaterThan(0)
    expect(r.informe.score).toBeGreaterThanOrEqual(antes)
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
