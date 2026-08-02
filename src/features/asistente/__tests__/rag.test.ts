import { describe, it, expect } from "vitest"
import data from "@/lib/services/vectorstore-data.json"
import { cosineSimilarity, extractNumbers, retrieveTopChunks, MIN_COSINE_SIMILARITY } from "../lib/rag"

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
})
