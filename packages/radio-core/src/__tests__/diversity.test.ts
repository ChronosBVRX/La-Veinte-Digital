import { describe, expect, it } from "vitest"
import { directRadioEpisode, analyzeDiversity, DEFAULT_SPEAKERS, type EvidenceClaim } from "@la-veinte/radio-core"

const CLAIMS: EvidenceClaim[] = Array.from({ length: 6 }, (_, i) => ({
  id: `C${i + 1}`,
  texto: `Evidencia ${i + 1}: se considera tiempo extraordinario el que excede los límites de la jornada diaria establecidos en el contrato.`,
  documento: "CCT-IMSS-SNTSS-2025-2027",
  clausula: `Cláusula ${32 + i}`,
  articulo: null,
  pagina: 30 + i,
}));

describe("DialogueDiversityAnalyzer", () => {
  it("da puntuación alta a diálogos variados", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 5, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS.slice(0, 2),
      cutoff: "2026-08-14", fuentes: [],
    })
    const r = analyzeDiversity(script)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.stats.turnos).toBe(script.turns.length)
  })

  it("detecta texto idéntico repetido", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 5, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS.slice(0, 2),
      cutoff: "2026-08-14", fuentes: [],
    })
    script.turns.push({ ...script.turns[1], id: "dup1" })
    script.turns.push({ ...script.turns[1], id: "dup2" })
    const r = analyzeDiversity(script)
    expect(r.issues.some((i) => i.tipo === "texto_repetido")).toBe(true)
  })

  it("detecta dominancia de un locutor", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 5, speakers: DEFAULT_SPEAKERS, nivel: "informativo", claims: CLAIMS.slice(0, 2),
      cutoff: "2026-08-14", fuentes: [],
    })
    const base = script.turns[0]
    for (let i = 0; i < 30; i++) script.turns.push({ ...base, id: `dom${i}`, text: `Texto adicional variado ${i} para el análisis de dominancia conversacional.` })
    const r = analyzeDiversity(script)
    expect(r.issues.some((i) => i.tipo === "dominancia")).toBe(true)
  })

  it("detecta muletillas repetidas", () => {
    const script = directRadioEpisode({
      tema: "T", duracionMin: 8, speakers: DEFAULT_SPEAKERS, nivel: "natural", claims: CLAIMS,
      cutoff: "2026-08-14", fuentes: [],
    })
    const r = analyzeDiversity(script)
    expect(r.issues.some((i) => i.tipo === "muletilla" || i.tipo === "inicio_similar")).toBe(true)
  })
})
