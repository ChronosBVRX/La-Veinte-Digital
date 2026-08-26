import { describe, it, expect } from "vitest"
import data from "@/lib/services/vectorstore-data.json"
import {
  cosineSimilarity,
  extractNumbers,
  retrieveTopChunks,
  selectWithinThreshold,
  MIN_COSINE_SIMILARITY,
} from "../lib/rag"

const zeroEmbedding = () => new Array(data.embeddings[0].length).fill(0)

describe("rag - cosineSimilarity", () => {
  it("vectores idénticos dan 1", () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBe(1)
  })

  it("vectores ortogonales dan 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })
})

describe("rag - extractNumbers", () => {
  it("extrae artículos y cláusulas sin duplicados", () => {
    expect(extractNumbers("cláusula 47 y artículo 12 y CLAUSULA 47", /art[iíïi]culo\s*(\d+)/gi)).toEqual([12])
    expect(extractNumbers("cláusula 47 y artículo 12 y CLAUSULA 47", /cl[aá]usula\s*(\d+)/gi)).toEqual([47])
  })

  it("devuelve vacío sin coincidencias", () => {
    expect(extractNumbers("hola", /art[iíïi]culo\s*(\d+)/gi)).toEqual([])
  })
})

describe("rag - retrieveTopChunks", () => {
  it("pregunta sin relación devuelve lista vacía (umbral mínimo)", () => {
    expect(retrieveTopChunks(zeroEmbedding(), "¿qué comeré hoy?")).toEqual([])
  })

  it("embedding idéntico al primer fragmento lo recupera primero", () => {
    const first = data.embeddings[0]
    const result = retrieveTopChunks(first, "")
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toBe(data.chunks[0])
  })

  it("respeta el límite k", () => {
    const result = retrieveTopChunks(data.embeddings[0], "", 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it("el umbral es mayor que cero y la constante está exportada", () => {
    expect(MIN_COSINE_SIMILARITY).toBeGreaterThan(0)
  })

  it("REGRESIÓN: candidato con boost alto pero cosine bajo no corta el recorrido", () => {
    // Ordenado por score: el 1º tiene boost enorme pero cosine < umbral;
    // los 2º y 3º tienen cosine válido. Antes del fix, `break` al llegar
    // al primero descartaba a los válidos; `continue` los conserva.
    const scored = [
      { score: 10.0, cosine: 0.05, idx: 1 },
      { score: 0.8, cosine: 0.9, idx: 2 },
      { score: 0.7, cosine: 0.7, idx: 3 },
    ]
    const chunks = ["a", "invalido-con-boost", "valido-b", "valido-c"]
    const result = selectWithinThreshold(scored, chunks, 8)
    expect(result).toEqual(["valido-b", "valido-c"])
    expect(result).not.toContain("invalido-con-boost")
  })

  it("selectWithinThreshold respeta k tras filtrar inválidos", () => {
    const scored = [
      { score: 5, cosine: 0.1, idx: 0 },
      { score: 4, cosine: 0.2, idx: 1 },
      { score: 0.6, cosine: 0.6, idx: 2 },
      { score: 0.5, cosine: 0.5, idx: 3 },
    ]
    const result = selectWithinThreshold(scored, ["x0", "x1", "x2", "x3"], 1)
    expect(result).toEqual(["x2"])
  })

  it("cosine no finito nunca se selecciona", () => {
    const result = selectWithinThreshold([{ score: 99, cosine: NaN, idx: 0 }], ["raro"], 5)
    expect(result).toEqual([])
  })
})
