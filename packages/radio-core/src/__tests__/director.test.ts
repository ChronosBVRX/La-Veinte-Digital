import { describe, expect, it } from "vitest"
import { directRadioEpisode, DEFAULT_SPEAKERS, type EvidenceClaim } from "@la-veinte/radio-core"
import { buildMixPlan } from "@la-veinte/radio-core"

const CLAIMS: EvidenceClaim[] = [
  {
    id: "C1",
    texto: "Se considerará como tiempo extraordinario el que exceda los límites de la jornada diaria.",
    documento: "CCT-IMSS-SNTSS-2025-2027",
    clausula: "Cláusula 32",
    articulo: null,
    pagina: 30,
  },
  {
    id: "C2",
    texto: "El pago se cubrirá con un cien por ciento más del salario correspondiente.",
    documento: "CCT-IMSS-SNTSS-2025-2027",
    clausula: "Cláusula 37",
    articulo: null,
    pagina: 31,
  },
  {
    id: "C3",
    texto: "La jornada máxima será de ocho horas.",
    documento: "LFT",
    clausula: null,
    articulo: "Artículo 67",
    pagina: 20,
  },
];

function makeScript(nivel: "informativo" | "natural" | "dinamico") {
  return directRadioEpisode({
    tema: "Tiempo extraordinario en el IMSS",
    duracionMin: 10,
    speakers: DEFAULT_SPEAKERS,
    nivel,
    claims: CLAIMS,
    cutoff: "2026-08-14",
    fuentes: [],
  });
}

describe("RadioDirector", () => {
  it("genera la escaleta permanente del programa", () => {
    const s = makeScript("natural");
    const titulos = s.scenes.map((x) => x.titulo);
    expect(titulos[0]).toBe("Apertura")
    expect(titulos).toContain("Caso de arranque")
    expect(titulos).toContain("Qué dice la normativa")
    expect(titulos).toContain("Ojo con esto")
    expect(titulos[titulos.length - 1]).toBe("Cierre práctico")
    expect(s.formato).toContain("caso")
  })

  it("incluye los tres roles cuando existen", () => {
    const s = makeScript("natural")
    const speakers = new Set(s.turns.map((t) => t.speaker))
    expect(speakers.has("EDUARDO")).toBe(true)
    expect(speakers.has("ANDREA")).toBe(true)
    expect(speakers.has("NARRADOR")).toBe(true)
  })

  it("el narrador cita natural por defecto y exacta en modo técnico", () => {
    const s = makeScript("natural")
    const narraciones = s.turns.filter((t) => t.speaker === "NARRADOR")
    // natural: sin leer cláusulas ni páginas al aire
    expect(narraciones.some((t) => t.text.includes("Contrato Colectivo vigente"))).toBe(true)
    expect(narraciones.every((t) => !/\bpágina\b/i.test(t.text))).toBe(true)
    expect(s.turns.filter((t) => t.citations.includes("C1")).length).toBeGreaterThanOrEqual(2)

    const tecnico = directRadioEpisode({
      tema: "Tiempo extraordinario en el IMSS",
      duracionMin: 10,
      speakers: DEFAULT_SPEAKERS,
      nivel: "natural",
      claims: CLAIMS,
      cutoff: "2026-08-14",
      fuentes: [],
      modoCita: "tecnico",
    })
    const narracionesTec = tecnico.turns.filter((t) => t.speaker === "NARRADOR")
    expect(narracionesTec.some((t) => t.text.includes("CCT-IMSS-SNTSS-2025-2027") && t.text.includes("Cláusula 32") && t.text.includes("página 30"))).toBe(true)
  })

  it("cada afirmación de evidencia lleva su cita en el turno", () => {
    const s = makeScript("natural")
    const citados = s.turns.filter((t) => t.citations.length > 0)
    expect(citados.length).toBeGreaterThanOrEqual(CLAIMS.length)
  })

  it("nivel informativo: pausas largas y sin solapes", () => {
    const s = makeScript("informativo")
    expect(s.turns.every((t) => !t.canOverlap)).toBe(true)
    const pausas = s.turns.map((t) => t.pauseBeforeMs)
    expect(Math.min(...pausas.filter((x) => x > 0))).toBeGreaterThanOrEqual(300)
  })

  it("nivel dinámico: reacciones cortas con solape permitido", () => {
    const s = makeScript("dinamico")
    expect(s.turns.some((t) => t.canOverlap)).toBe(true)
    const reacciones = s.turns.filter((t) => t.canOverlap)
    for (const r of reacciones) {
      expect(r.text.trim().length).toBeLessThanOrEqual(30)
    }
  })

  it("estima duración y respeta el presupuesto de minutos", () => {
    const s = makeScript("natural")
    expect(s.estimacionDurSec).toBeGreaterThan(0)
    expect(s.estimacionDurSec).toBeLessThanOrEqual(10 * 60 + 120)
  })

  it("todos los turnos tienen ids únicos y metadatos completos", () => {
    const s = makeScript("natural")
    const ids = new Set(s.turns.map((t) => t.id))
    expect(ids.size).toBe(s.turns.length)
    for (const t of s.turns) {
      expect(t.energy).toBeGreaterThanOrEqual(1)
      expect(t.energy).toBeLessThanOrEqual(5)
      expect(["lento", "normal", "rapido"]).toContain(t.pace)
      expect(typeof t.pauseBeforeMs).toBe("number")
      expect(typeof t.pauseAfterMs).toBe("number")
    }
  })
})

describe("buildMixPlan (mezcla multipista)", () => {
  it("coloca turnos secuencialmente con pausas", () => {
    const s = makeScript("informativo")
    const plan = buildMixPlan(s.turns)
    expect(plan.voices.length).toBe(s.turns.length)
    for (let i = 1; i < plan.voices.length; i++) {
      const prev = plan.voices[i - 1]
      const cur = plan.voices[i]
      expect(cur.startMs).toBeGreaterThanOrEqual(prev.startMs + prev.durMs)
    }
  })

  it("aplica solape solo a reacciones cortas", () => {
    const s = makeScript("dinamico")
    const plan = buildMixPlan(s.turns, { overlapMs: 140 })
    expect(plan.overlapMs).toBeGreaterThan(0)
    for (let i = 1; i < plan.voices.length; i++) {
      const prev = plan.voices[i - 1]
      const cur = plan.voices[i]
      if (cur.startMs < prev.startMs + prev.durMs) {
        expect(s.turns[i].text.trim().length).toBeLessThanOrEqual(60)
      }
    }
  })

  it("incluye cama y cortinilla con niveles y ducking", () => {
    const s = makeScript("natural")
    const plan = buildMixPlan(s.turns, { bed: "bed.wav", jingle: "jingle.wav", bedDuckDb: 10 })
    const bed = plan.extras.find((e) => e.kind === "bed")
    const jingle = plan.extras.find((e) => e.kind === "jingle")
    expect(bed?.duckWhenVoice).toBe(true)
    expect(bed?.gainDb).toBe(-18)
    expect(plan.bedDuckDb).toBe(10)
    expect(jingle?.startMs).toBe(0)
    expect(plan.totalMs).toBeGreaterThan(0)
  })
})
