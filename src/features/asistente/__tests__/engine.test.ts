import { describe, it, expect } from "vitest"
import {
  classifyRetrievalIntent,
  EVIDENCE_BUDGET,
  OUTPUT_BUDGET,
  buildCompactEvidence,
  evidenceLocation,
  type RetrievedSource,
} from "../lib/retrieval-sources"
import {
  STATIC_SYSTEM_PROMPT,
  intentGuidance,
  trimHistory,
  outputTokensForIntent,
  evidenceRangeForIntent,
} from "../lib/engine"
import { EmbeddingCache } from "../lib/embedding-cache"

const REQUIRED_15 = [
  "Muéstrame la cláusula 63 Bis",
  "Explícame la cláusula 63 Bis",
  "¿Qué es la NOM-229?",
  "¿Cuántos días de vacaciones tengo?",
  "¿Cuánto aguinaldo me corresponde?",
  "¿Cuáles son mis derechos laborales?",
  "Mi jefe me amenaza",
  "Si un jefe me agrede y hostiga, ¿cómo puedo comprobarlo y evidenciarlo?",
  "Me quieren levantar un acta",
  "Me pusieron actividades fuera de categoría",
  "Me negaron vacaciones",
  "Ya tengo mensajes de WhatsApp",
  "¿Y si hay testigos?",
  "¿Cuáles son los Estatutos SNTSS 2026?",
  "¿Ya trabajamos 40 horas?",
]

describe("intent determinista sin LLM (punto 4)", () => {
  it("clasifica las 15 consultas obligatorias correctamente", () => {
    const expected: Record<string, string> = {
      "Muéstrame la cláusula 63 Bis": "EXACT_LOOKUP",
      "Explícame la cláusula 63 Bis": "EXACT_EXPLAIN",
      "¿Qué es la NOM-229?": "EXACT_EXPLAIN",
      "¿Cuántos días de vacaciones tengo?": "SPECIFIC_TOPIC",
      "¿Cuánto aguinaldo me corresponde?": "SPECIFIC_TOPIC",
      "¿Cuáles son mis derechos laborales?": "BROAD_TOPIC",
      "Mi jefe me amenaza": "LABOR_CASE",
      "Si un jefe me agrede y hostiga, ¿cómo puedo comprobarlo y evidenciarlo?": "LABOR_CASE",
      "Me quieren levantar un acta": "LABOR_CASE",
      "Me pusieron actividades fuera de categoría": "LABOR_CASE",
      "Me negaron vacaciones": "LABOR_CASE",
      "Ya tengo mensajes de WhatsApp": "FOLLOW_UP",
      "¿Y si hay testigos?": "FOLLOW_UP",
      "¿Cuáles son los Estatutos SNTSS 2026?": "SPECIFIC_TOPIC",
      "¿Ya trabajamos 40 horas?": "SPECIFIC_TOPIC",
    }
    for (const q of REQUIRED_15) {
      expect(classifyRetrievalIntent(q)).toBe(expected[q])
    }
  })

  it("solo produce intenciones válidas de la taxonomía", () => {
    const valid = ["EXACT_LOOKUP", "EXACT_EXPLAIN", "SPECIFIC_TOPIC", "BROAD_TOPIC", "LABOR_CASE", "FOLLOW_UP"]
    for (const q of REQUIRED_15) {
      expect(valid).toContain(classifyRetrievalIntent(q))
    }
  })
})

describe("presupuestos por intención (puntos 7 y 14)", () => {
  it("rango de evidencias por intención", () => {
    expect(evidenceRangeForIntent("EXACT_LOOKUP")).toEqual({ min: 1, max: 3 })
    expect(evidenceRangeForIntent("EXACT_EXPLAIN")).toEqual({ min: 3, max: 5 })
    expect(evidenceRangeForIntent("SPECIFIC_TOPIC")).toEqual({ min: 4, max: 6 })
    expect(evidenceRangeForIntent("BROAD_TOPIC")).toEqual({ min: 5, max: 8 })
    expect(evidenceRangeForIntent("LABOR_CASE")).toEqual({ min: 5, max: 8 })
    expect(evidenceRangeForIntent("FOLLOW_UP")).toEqual({ min: 4, max: 6 })
  })

  it("nunca excede el hard max de 8", () => {
    for (const k of Object.keys(EVIDENCE_BUDGET) as (keyof typeof EVIDENCE_BUDGET)[]) {
      expect(EVIDENCE_BUDGET[k].max).toBeLessThanOrEqual(8)
    }
  })

  it("presupuesto de salida por intención", () => {
    expect(outputTokensForIntent("EXACT_LOOKUP")).toBe(300)
    expect(outputTokensForIntent("EXACT_EXPLAIN")).toBe(300)
    expect(outputTokensForIntent("SPECIFIC_TOPIC")).toBe(400)
    expect(outputTokensForIntent("BROAD_TOPIC")).toBe(500)
    expect(outputTokensForIntent("LABOR_CASE")).toBe(550)
    expect(outputTokensForIntent("FOLLOW_UP")).toBe(450)
    expect(Object.keys(OUTPUT_BUDGET)).toHaveLength(6)
  })
})

describe("evidencia compacta para el LLM (punto 9)", () => {
  const src: RetrievedSource = {
    id: "S1",
    chunkId: "x@V1:1",
    documentId: "CCT",
    documento: "Contrato Colectivo IMSS-SNTSS",
    version: "CCT@V1",
    tipo: "clausula",
    numero: "63 Bis",
    paginaInicio: 44,
    paginaFin: 44,
    fragmento: "texto de la cláusula",
    sourceUrl: "https://url.larga",
    validity: "CURRENT",
    pendingReview: false,
    score: 1000,
  }

  it("incluye etiqueta, documento, cita y página — sin ids/scores/urls", () => {
    const out = buildCompactEvidence([src])
    expect(out).toContain("[S1]")
    expect(out).toContain("Contrato Colectivo IMSS-SNTSS")
    expect(out).toContain("Cláusula 63 Bis")
    expect(out).toContain("pág. 44")
    expect(out).not.toContain("x@V1:1")
    expect(out).not.toContain("https://url.larga")
    expect(out).not.toContain("score")
    expect(out).not.toContain("1000")
  })

  it("marca vigencia por revisar", () => {
    const out = buildCompactEvidence([{ ...src, validity: "PENDING_REVIEW", pendingReview: true }])
    expect(out).toContain("VIGENCIA POR REVISAR")
  })

  it("evidenceLocation devuelve cita + página", () => {
    expect(evidenceLocation(src)).toBe("Cláusula 63 Bis · pág. 44")
  })
})

describe("system prompt reducido (punto 10)", () => {
  it("está muy por debajo del baseline: objetivo ~600-900 tokens, se mantiene bajo", () => {
    // Baseline era ~2900 tokens (11.5k chars). El prompt estático reducido
    // debe quedar claramente debajo de 950 tokens aproximados.
    const tokens = Math.round(STATIC_SYSTEM_PROMPT.length / 4)
    expect(tokens).toBeLessThanOrEqual(950)
    expect(tokens).toBeGreaterThanOrEqual(250)
  })

  it("intentGuidance cubre todas las intenciones", () => {
    for (const k of ["EXACT_LOOKUP", "EXACT_EXPLAIN", "SPECIFIC_TOPIC", "BROAD_TOPIC", "LABOR_CASE", "FOLLOW_UP"] as const) {
      expect(intentGuidance(k).length).toBeGreaterThan(0)
    }
  })
})

describe("historial recortado (punto 11)", () => {
  it("guarda un máximo de 6 mensajes", () => {
    const hist = Array.from({ length: 20 }, (_, i) => ({ role: "user", content: `msg ${i}` }))
    expect(trimHistory(hist)).toHaveLength(6)
  })

  it("respeta el presupuesto duro de caracteres", () => {
    const hist = Array.from({ length: 10 }, () => ({ role: "user", content: "x".repeat(2000) }))
    const out = trimHistory(hist, 20, 4000)
    expect(out.reduce((a, m) => a + m.content.length, 0)).toBeLessThanOrEqual(4000)
  })

  it("conserva los más recientes y preserva el orden", () => {
    const hist = [{ role: "user", content: "a" }, { role: "user", content: "b" }, { role: "user", content: "c" }]
    expect(trimHistory(hist).map((m) => m.content)).toEqual(["a", "b", "c"])
  })
})

describe("LRU embedding cache (punto 6)", () => {
  it("reutiliza hasta el tope y expulsa el más antiguo (LRU)", () => {
    const cache = new EmbeddingCache(3)
    cache.set("a", [1])
    cache.set("b", [2])
    cache.set("c", [3])
    expect(cache.get("a")).toEqual([1]) // reciente
    cache.set("d", [4]) // expulsa el más antiguo (b)
    expect(cache.has("b")).toBe(false)
    expect(cache.has("a")).toBe(true)
    expect(cache.has("c")).toBe(true)
    expect(cache.has("d")).toBe(true)
  })

  it("miss devuelve undefined", () => {
    const cache = new EmbeddingCache(2)
    expect(cache.get("nope")).toBeUndefined()
  })
})
