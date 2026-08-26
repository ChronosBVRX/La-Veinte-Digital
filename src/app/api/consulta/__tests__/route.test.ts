import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { POST } from "../route"
import { withAbortTimeout } from "@/features/asistente/lib/assistant-policy"
import type { User } from "@supabase/supabase-js"

const MOCK_USER = {
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/consulta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response
}

vi.mock("@/shared/server/auth/require-user", () => ({
  requireUser: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

// El retrieval híbrido se mockea por completo: la ruta no debe tocar el
// vectorstore legacy ni Supabase en estas pruebas unitarias.
vi.mock("@/features/asistente/lib/retrieval-pgvector", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/asistente/lib/retrieval-pgvector")
  >()
  return {
    ...actual,
    retrieveEvidenceWithMetrics: vi.fn(),
  }
})

const RETRIEVAL_METRICS_FIXTURE: RetrievalMetrics = {
  exactMs: null,
  ftsMs: 1,
  vectorMs: 2,
  fusionMs: 0,
  totalMs: 3,
  rows: { exact: 0, fts: 5, vector: 5 },
  intent: "SPECIFIC_TOPIC" as const,
}

function streamOf(text: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: text } }] }
    },
  }
}

const SOURCE_FIXTURE = {
  id: "S1",
  chunkId: "CCT-IMSS-SNTSS-2025-2027@V1:10",
  documentId: "CCT-IMSS-SNTSS-2025-2027",
  documento: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
  version: "CCT-IMSS-SNTSS-2025-2027@V1",
  tipo: "clausula",
  numero: "47",
  paginaInicio: 30,
  paginaFin: 31,
  fragmento: "fragmento de prueba",
  sourceUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
  validity: "CURRENT",
  pendingReview: false,
  score: 100,
}

import { requireUser } from "@/shared/server/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { retrieveEvidenceWithMetrics } from "@/features/asistente/lib/retrieval-pgvector"
import type { RetrievalMetrics } from "@/features/asistente/lib/retrieval-pgvector"

const mockEmbeddingsCreate = vi.fn()
const mockChatCompletionsCreate = vi.fn()

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return {
      embeddings: { create: mockEmbeddingsCreate },
      chat: { completions: { create: mockChatCompletionsCreate } },
    }
  }),
}))


describe("POST /api/consulta", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" })
    process.env.OPENAI_API_KEY = "sk-test"
    delete process.env.BOT_API_URL
    delete process.env.BOT_API_SHARED_SECRET

    vi.mocked(requireUser).mockReset()
    vi.mocked(createClient).mockReset()
    vi.mocked(retrieveEvidenceWithMetrics).mockReset()
    vi.mocked(retrieveEvidenceWithMetrics).mockResolvedValue({
      sources: [{ ...SOURCE_FIXTURE }],
      metrics: { ...RETRIEVAL_METRICS_FIXTURE },
    })
    mockEmbeddingsCreate.mockReset()
    mockChatCompletionsCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("rechaza petición inválida sin consumir cuota", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    const res = await POST(jsonRequest({ history: [] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rechaza pregunta demasiado larga sin consumir cuota", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "x".repeat(2001) }] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("consume cuota solo después de validar", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Respuesta directa [S1]"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)

    // Las fuentes provienen del retrieval, no del texto del LLM.
    const data = await res.json()
    expect(Array.isArray(data.fuentes)).toBe(true)
    expect(data.fuentes[0].documento).toContain("IMSS-SNTSS")
    expect(data.fuentes[0].validity).toBe("CURRENT")
    expect(data.respuesta).toContain("[S1]")
    // Consulta informativa → sin chips de acompañamiento.
    expect(data.chips).toEqual([])
  })

  it("consulta de conflicto laboral → devuelve chips de acompañamiento", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never)
    vi.mocked(retrieveEvidenceWithMetrics).mockResolvedValue({
      sources: [{ ...SOURCE_FIXTURE }],
      metrics: { ...RETRIEVAL_METRICS_FIXTURE },
    })

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Puedes documentarlo desde ahora [S1]"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "Mi jefe me amenaza." }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.chips)).toBe(true)
    expect(data.chips.length).toBeGreaterThan(0)
    expect(data.chips.length).toBeLessThanOrEqual(4)
  })

  it("elimina citas [S#] que no corresponden a fuentes recuperadas", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never)

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Inventado [S7] y válido [S1]"))
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Inventado [S7] y válido [S1]"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    const data = await res.json()
    expect(data.respuesta).not.toContain("[S7]")
    expect(data.respuesta).toContain("[S1]")
  })

  it("sin evidencia recuperada no llama al LLM y avisa sin inventar", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never)
    vi.mocked(retrieveEvidenceWithMetrics).mockResolvedValue({
      sources: [],
      metrics: { ...RETRIEVAL_METRICS_FIXTURE },
    })

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("no debo llamarse"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "tema raro" }] }))
    expect(res.status).toBe(200)
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled()
    const data = await res.json()
    expect(data.fuentes).toEqual([])
  })

  it("REGRESIÓN: el sidecar Python NUNCA interviene aunque existan sus env vars", async () => {
    // El flujo obligatorio es auth/cuota → retrieval pgvector → LLM → [S#].
    // El bot legacy no puede bypasearlo ni siquiera con BOT_API_URL configurado.
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    process.env.BOT_API_URL = "https://bot.example.com"
    process.env.BOT_API_SHARED_SECRET = "secret"

    const fetchSpy = vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>)

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Respuesta directa pgvector [S1]"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Qué dice la cláusula 47?" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.respuesta).toContain("pgvector")

    // Ningún fetch al sidecar: el único fetch saliente permitido sería OpenAI
    // (que aquí está mockeado a nivel SDK, no global).
    const llamadasASidecar = fetchSpy.mock.calls.filter(
      (c) => String(c[0]).includes("bot.example.com"),
    )
    expect(llamadasASidecar).toHaveLength(0)
  })

  it("aplica Cache-Control private, no-store a respuestas exitosas", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("ok"))

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("usa timeouts independientes para embeddings y chat", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    let embeddingSignal: AbortSignal | undefined
    let chatSignal: AbortSignal | undefined

    mockEmbeddingsCreate.mockImplementation(async (_params, options) => {
      embeddingSignal = options?.signal
      return { data: [{ embedding: new Array(1536).fill(0.01) }] } as never
    })

    mockChatCompletionsCreate.mockImplementation(async (_params, options) => {
      chatSignal = options?.signal
      return streamOf("ok")
    })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.status).toBe(200)
    expect(embeddingSignal).toBeDefined()
    expect(chatSignal).toBeDefined()
    expect(embeddingSignal).not.toBe(chatSignal)
  })
})

describe("withAbortTimeout", () => {
  it("resuelve cuando la operación termina antes del timeout", async () => {
    const result = await withAbortTimeout(1000, async () => "ok")
    expect(result).toBe("ok")
  })

  it("aborta la señal cuando se excede el timeout", async () => {
    await expect(
      withAbortTimeout(10, async (signal) => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return signal.aborted ? Promise.reject(new Error("aborted")) : "ok"
      }),
    ).rejects.toThrow("aborted")
  })

  it("limpia el timer si la operación termina rápido", async () => {
    const start = Date.now()
    await withAbortTimeout(10_000, async () => "ok")
    expect(Date.now() - start).toBeLessThan(100)
  })
})
