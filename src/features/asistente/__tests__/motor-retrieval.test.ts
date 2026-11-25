import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { embedQueryLru, retrieveHybrid } from "../lib/motor"
import { createClient } from "@/lib/supabase/server"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

function makeRow(partial: Partial<Record<string, unknown>>) {
  return {
    chunk_id: "DOC@V1:1",
    document_id: "CCT-IMSS-SNTSS-2025-2027",
    document_title: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
    version_id: "V1",
    validity: "CURRENT",
    section_type: "clausula",
    section_title: null,
    article: null,
    clause: null,
    numeral: null,
    page_start: 1,
    page_end: 1,
    text: "Contenido de prueba",
    source_url: null,
    score: 25,
    origin: "fts",
    ...partial,
  }
}

describe("motor: embedQueryLru y retrieveHybrid", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("embedQueryLru degrada limpio cuando falta OPENAI_API_KEY (entorno solo-DeepSeek)", async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const res = await embedQueryLru("¿Cuántos días de vacaciones tengo?", "SPECIFIC_TOPIC")
      expect(res.embedding).toBeNull()
      expect(res.skipped).toBe(true)
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev
    }
  })

  it("embedQueryLru omite OpenAI cuando DEEPSEEK_API_KEY está activa aunque exista OPENAI_API_KEY residual", async () => {
    const prevOpenai = process.env.OPENAI_API_KEY
    const prevDeepseek = process.env.DEEPSEEK_API_KEY
    const prevProv = process.env.LLM_PROVIDER
    process.env.OPENAI_API_KEY = "sk-old-empty"
    process.env.DEEPSEEK_API_KEY = "ds-active"
    delete process.env.LLM_PROVIDER
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    try {
      const res = await embedQueryLru("¿Cómo funciona el escalafón?", "SPECIFIC_TOPIC")
      expect(res.embedding).toBeNull()
      expect(res.skipped).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai
      else delete process.env.OPENAI_API_KEY
      if (prevDeepseek !== undefined) process.env.DEEPSEEK_API_KEY = prevDeepseek
      else delete process.env.DEEPSEEK_API_KEY
      if (prevProv !== undefined) process.env.LLM_PROVIDER = prevProv
      else delete process.env.LLM_PROVIDER
    }
  })

  it("retrieveHybrid en modo FTS-puro relaja a OR si la primera búsqueda estricta devuelve <2 filas", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          makeRow({ chunk_id: "CCT@1", score: 22, text: "Reglas de discriminación y respeto." }),
          makeRow({ chunk_id: "LFT@1", document_id: "LFT", score: 18, text: "Prohibición de discriminación." }),
        ],
        error: null,
      })
    vi.mocked(createClient).mockResolvedValue({ rpc: rpcMock } as never)

    const { sources, rpcCalls } = await retrieveHybrid(
      "siento discriminado trabajo",
      null,
      "SPECIFIC_TOPIC",
      {},
      6,
      "Me siento discriminado en el trabajo",
    )
    expect(rpcCalls).toBe(2)
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      "hybrid_normativa_rrf",
      expect.objectContaining({ p_query: "siento OR discriminado OR trabajo" }),
    )
    expect(sources.length).toBe(2)
  })

  it("descarta normativa SUPERSEDED/HISTORICAL cuando existen al menos 2 fragmentos CURRENT", async () => {
    const rows = [
      makeRow({ chunk_id: "OLD@V1:1", document_id: "NOM-017-STPS-2008", validity: "SUPERSEDED", score: 50, text: "Norma vieja" }),
      makeRow({ chunk_id: "NEW@V1:1", document_id: "NOM-017-STPS-2024", validity: "CURRENT", score: 38, text: "Norma vigente 2024 parte 1" }),
      makeRow({ chunk_id: "NEW@V1:2", document_id: "NOM-017-STPS-2024", validity: "CURRENT", score: 34, text: "Norma vigente 2024 parte 2" }),
    ]
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    } as never)

    const { sources } = await retrieveHybrid("equipo proteccion personal", null, "SPECIFIC_TOPIC", {}, 6, "¿Qué equipo de protección personal deben darme?")
    expect(sources.some((s) => s.documentId === "NOM-017-STPS-2008")).toBe(false)
    expect(sources.every((s) => s.documentId === "NOM-017-STPS-2024")).toBe(true)
  })

  it("preserva al frente el documento nombrado explícitamente (ej. INFONAVIT) frente a menciones débiles del CCT", async () => {
    const rows = [
      makeRow({ chunk_id: "CCT@V1:10", document_id: "CCT-IMSS-SNTSS-2025-2027", document_title: "CCT", score: 12, text: "Mención breve de vivienda." }),
      makeRow({ chunk_id: "CCT@V1:11", document_id: "CCT-IMSS-SNTSS-2025-2027", document_title: "CCT", score: 11, text: "Otra mención breve." }),
      makeRow({ chunk_id: "INF@V1:1", document_id: "LEY-INFONAVIT", document_title: "Ley del Instituto del Fondo Nacional de la Vivienda para los Trabajadores", score: 45, text: "Artículo 42 créditos INFONAVIT." }),
    ]
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    } as never)

    const { sources } = await retrieveHybrid("infonavit credito", null, "SPECIFIC_TOPIC", {}, 6, "¿Cómo funciona mi crédito INFONAVIT?")
    expect(sources[0].documentId).toBe("LEY-INFONAVIT")
  })

  it("diversifica documentos en consultas SPECIFIC_TOPIC multifaceta (Tabulador + CCT + Profesiograma)", async () => {
    const rows = [
      makeRow({ chunk_id: "TAB@1", document_id: "IMSS-TABULADOR-BASE-2025-2026", document_title: "Tabulador", score: 40, text: "Sueldo tabular radiólogo 8h." }),
      makeRow({ chunk_id: "TAB@2", document_id: "IMSS-TABULADOR-BASE-2025-2026", document_title: "Tabulador", score: 39, text: "Sueldo tabular radiólogo 6.5h." }),
      makeRow({ chunk_id: "CCT@1", document_id: "CCT-IMSS-SNTSS-2025-2027", document_title: "CCT", score: 35, text: "Cláusula 86 Bis emanaciones radiactivas." }),
      makeRow({ chunk_id: "PROF@1", document_id: "PROFESIOGRAMAS", document_title: "Profesiogramas", score: 30, text: "Funciones técnico radiólogo." }),
    ]
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    } as never)

    const { sources } = await retrieveHybrid("sueldo radiologo riesgo profesiograma", null, "SPECIFIC_TOPIC", {}, 4, "¿Cuánto gana un radiólogo, qué riesgo tiene y qué hace?")
    const docIds = new Set(sources.map((s) => s.documentId))
    expect(docIds.size).toBe(3)
  })
})
